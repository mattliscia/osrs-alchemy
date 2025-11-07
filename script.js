const headers = {
    'User-Agent': 'Spr3adsh33t on Discord - Comparing GE prices to HA'
};

async function fetchData(url) {
    const response = await fetch(url, { headers });
    return await response.json();
}

async function processData() {
    const [priceData, individualPriceData, mapping] = await Promise.all([
        fetchData('https://prices.runescape.wiki/api/v1/osrs/latest'),
        fetchData('https://prices.runescape.wiki/api/v1/osrs/1h'),
        fetchData('https://prices.runescape.wiki/api/v1/osrs/mapping')
    ]);

    const natureRunePrice = individualPriceData.data[561].avgHighPrice;
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

    const mergedData = mapping
        .filter(item => item.name !== "Old school bond" && !item.name.toLowerCase().includes("contract") && item.limit !== undefined && item.limit !== null)
        .map(item => {
            const id = item.id;
            const priceInfo = priceData.data[id];
            if (!priceInfo) return null;

            const highPrice = priceInfo.high;
            const lowPrice = priceInfo.low;
            const maxPrice = Math.max(highPrice, lowPrice);

            const timeSinceHighUpdate = currentTime - priceInfo.highTime;
            const timeSinceLowUpdate = currentTime - priceInfo.lowTime;

            if (timeSinceHighUpdate > 600 || timeSinceLowUpdate > 600) {
                return null;
            }

            const iconUrl = `https://oldschool.runescape.wiki/images/${item.icon.replace(/ /g, '_')}`;

            return {
                ...item,
                ...priceInfo,
                LA_Profit: item.lowalch - maxPrice - natureRunePrice,
                HA_Profit: item.highalch - maxPrice - natureRunePrice,
                HA_Margin: (item.highalch - maxPrice - natureRunePrice) / maxPrice,
                iconUrl: iconUrl
            };
        })
        .filter(item => item !== null);

    const laData = mergedData.sort((a, b) => b.LA_Profit - a.LA_Profit).slice(0, 100);
    const haData = mergedData.sort((a, b) => b.HA_Profit - a.HA_Profit).slice(0, 100);

    return { laData, haData };
}

const iconContainerWidth = 40; // Adjust this value as needed

const renderItemColumn = function(data, type, row) {
    if (type === 'sort' || type === 'filter') {
        return data;
    }
    const itemLink = `https://prices.runescape.wiki/osrs/item/${row.id}`;
    const iconHtml = `
        <div style="width:${iconContainerWidth}px;height:${iconContainerWidth}px;display:flex;align-items:center;justify-content:center;margin-right:10px;">
            <img src="${row.iconUrl}" alt="${data}" style="max-width:100%;max-height:100%;object-fit:contain;">
        </div>
    `;
    const nameHtml = `<a href="${itemLink}" target="_blank" style="color: inherit; text-decoration: none;">${data}</a>`;
    const combinedHtml = `<div style="display:flex;align-items:center;">${iconHtml}<span>${nameHtml}</span></div>`;
    return row.members ? `<span style="color: gold;">${combinedHtml}</span>` : combinedHtml;
};

function formatMembersItems(data, type, row) {
    if (type === 'display') {
        const itemLink = `https://prices.runescape.wiki/osrs/item/${row.id}`;
        const nameWithLink = `<a href="${itemLink}" target="_blank" style="color: inherit; text-decoration: none;">${data}</a>`;
        return row.members ? `<span style="color: gold;">${nameWithLink}</span>` : nameWithLink;
    }
    return data;
}

function formatProfitOrMargin(value, isPercentage = false) {
    const formattedValue = isPercentage ? (value * 100).toFixed(2) + '%' : Math.round(value).toLocaleString();
    const color = value < 0 ? 'red' : 'lightgreen';
    return `<span style="color: ${color};">${formattedValue}</span>`;
}

function calculatePotentialProfit(row, bankroll, timeInMinutes, isHighAlch) {
    const maxCastsPerHour = isHighAlch ? 1200 : 2000;
    const maxCasts = Math.floor((maxCastsPerHour / 60) * timeInMinutes);
    const buyLimit = row.limit;
    //const buyLimitForTime = Math.ceil(timeInMinutes / 240) * buyLimit; // 240 minutes = 4 hours
    const buyLimitForTime = buyLimit;
    const itemPrice = Math.max(row.high, row.low);
    const profit = isHighAlch ? row.HA_Profit : row.LA_Profit;

    const maxAffordable = Math.floor(bankroll / itemPrice);
    const maxPossible = Math.min(maxCasts, buyLimitForTime, maxAffordable);

    const potentialProfit = Math.round(profit * maxPossible);

    // Debug logging for "Yew Longbow"
    if (row.name === "Yew longbow" || row.name === "Amulet of the damned (full)") {
        console.log(`Debug for ${row.name} (${isHighAlch ? 'High' : 'Low'} Alch):`);
        console.log("bankroll:", bankroll);
        console.log("timeInMinutes:", timeInMinutes);
        console.log("maxCastsPerHour:", maxCastsPerHour);
        console.log("maxCasts:", maxCasts);
        console.log("buyLimit:", buyLimit);
        console.log("buyLimitForTime:", buyLimitForTime);
        console.log("itemPrice:", itemPrice);
        console.log("profit:", profit);
        console.log("maxAffordable:", maxAffordable);
        console.log("maxPossible:", maxPossible);
        console.log("potentialProfit:", potentialProfit);
    }

    return potentialProfit;
}

function populateTables(laData, haData) {
    const bankroll = parseBankrollInput($('#bankrollInput').val()) || 1000000;
    const timeInMinutes = parseInt($('#timeInput').val()) || 10;
    console.log('Populating tables with:');
    console.log('Bankroll:', bankroll);
    console.log('Time in Minutes:', timeInMinutes);

    function renderLimit(data, type, row, isHighAlch) {
        if (type === 'sort' || type === 'type') {
            return data;
        }
        const maxCastsPerHour = isHighAlch ? 1200 : 2000;
        const maxCasts = Math.floor((maxCastsPerHour / 60) * timeInMinutes);
        const buyLimitForTime = Math.ceil(timeInMinutes / 240) * data; // 240 minutes = 4 hours
        const itemPrice = Math.max(row.high, row.low);
        const maxAffordable = Math.floor(bankroll / itemPrice);
        const maxPossible = Math.min(maxCasts, buyLimitForTime, maxAffordable);
        
        const maxColor = maxPossible === data ? 'orange' : 'lightgreen';
        
        // Calculate time for all casts
        const timeForAllCasts = Math.round((maxPossible / maxCastsPerHour) * 60);
        
        return `
            <div>
                <span style="color: ${maxColor}">${maxPossible.toLocaleString()}</span>/${data.toLocaleString()}
                <br>
                <small style="color: #888;">${timeForAllCasts} mins</small>
            </div>
        `;
    }

    const laColumns = [
        { 
            data: 'name', 
            title: 'Item', 
            className: 'dt-left', 
            render: renderItemColumn
        },
        { 
            data: 'high', 
            title: 'GE Price', 
            titleAttr: 'Prices of the most recent instant Buy (High) and Sell (Low)',
            render: (data, type, row) => {
                if (type === 'sort' || type === 'type') {
                    return data;
                }
                return `${data.toLocaleString()} <small>(${row.low.toLocaleString()})</small>`;
            }
        },
        { 
            data: 'LA_Profit', 
            title: 'Profit', 
            titleAttr: 'Alchemy Return - GE Buy (High) Item Price - Price of Nature Rune',
            render: (value, type) => type === 'display' ? formatProfitOrMargin(value) : value
        },
        { data: 'lowalch', title: 'Alchemy', render: value => value.toLocaleString(), visible: false },
        { 
            data: 'LA_Profit', 
            title: 'Margin', 
            titleAttr: '% return on invested gold',
            render: (value, type, row) => {
                const marginValue = value / Math.max(row.high, row.low);
                return type === 'display' ? formatProfitOrMargin(marginValue, true) : marginValue;
            }
        },
        { 
            data: 'limit', 
            title: 'Quantity', 
            titleAttr: '# of items you can purchase every 4 hours',
            render: (data, type, row) => renderLimit(data, type, row, false)
        },
        { 
            data: null, 
            title: 'Potential Profit', 
            render: (data, type, row) => {
                if (type === 'sort' || type === 'filter') {
                    // For sorting and filtering, return a numeric value
                    return calculatePotentialProfit(row, bankroll, timeInMinutes, false);
                }
                // For display, calculate and format
                const potentialProfit = calculatePotentialProfit(row, bankroll, timeInMinutes, false);
                return formatProfitOrMargin(potentialProfit);
            }
        }
    ];

    const haColumns = [
        { 
            data: 'name', 
            title: 'Item', 
            className: 'dt-left', 
            render: renderItemColumn
        },
        { 
            data: 'high', 
            title: 'GE Price', 
            titleAttr: 'Prices of the most recent instant Buy (High) and Sell (Low)',
            render: (data, type, row) => {
                if (type === 'sort' || type === 'type') {
                    return data;
                }
                return `${data.toLocaleString()} <small>(${row.low.toLocaleString()})</small>`;
            }
        },
        { 
            data: 'HA_Profit', 
            title: 'Profit', 
            titleAttr: 'Alchemy Return - GE Buy (High) Item Price - Price of Nature Rune',
            render: (value, type) => type === 'display' ? formatProfitOrMargin(value) : value
        },
        { data: 'highalch', title: 'Alchemy', render: value => value.toLocaleString(), visible: false },
        { 
            data: 'HA_Margin', 
            title: 'Margin', 
            titleAttr: '% return on invested gold',
            render: (value, type) => type === 'display' ? formatProfitOrMargin(value, true) : value
        },
        { 
            data: 'limit', 
            title: 'Quantity', 
            titleAttr: '# of items you can purchase every 4 hours',
            render: (data, type, row) => renderLimit(data, type, row, true)
        },
        { 
            data: null, 
            title: 'Potential Profit', 
            render: (data, type, row) => {
                if (type === 'sort' || type === 'filter') {
                    // For sorting and filtering, return a numeric value
                    return calculatePotentialProfit(row, bankroll, timeInMinutes, true);
                }
                // For display, calculate and format
                const potentialProfit = calculatePotentialProfit(row, bankroll, timeInMinutes, true);
                return formatProfitOrMargin(potentialProfit);
            }
        }
    ];

    const commonOptions = {
        pageLength: 25,
        responsive: true,
        autoWidth: true,
        lengthChange: false,
        columnDefs: [
            { targets: '_all', className: 'dt-center' },
            { targets: 1, className: 'dt-left' }
        ],
        dom: '<"top"f>rt<"bottom"ip><"clear">',
        language: {
            search: "_INPUT_",
            searchPlaceholder: "Search items..."
        },
        rowCallback: function(row, data) {
            $(row).css('cursor', 'pointer');
            $(row).on('click', function() {
                window.open(`https://prices.runescape.wiki/osrs/item/${data.id}`, '_blank');
            });
        },
        order: [[laColumns.length - 1, 'desc']] // Sort by the last column (Potential Profit) in descending order
    };

    $('#laAlchemyTable').DataTable({
        data: laData,
        columns: laColumns,
        ...commonOptions
    });

    $('#haAlchemyTable').DataTable({
        data: haData,
        columns: haColumns,
        ...commonOptions
    });

    addTooltips();
}

function addTooltips() {
    const tooltips = {
        'GE Price': 'Prices of the most recent instant Buy (High) and Sell (Low)',
        'Profit': 'Alchemy Return - GE Buy (High) Item Price - Price of Nature Rune',
        'Margin': '% return on invested gold',
        'Quantity': '# of items to purchase / 4hr limit'
    };

    $('.dataTable th').each(function() {
        const headerText = $(this).text().trim();
        if (tooltips[headerText]) {
            $(this).attr('title', tooltips[headerText]);
        }
    });

    $('.dataTable th[title]').tooltip({
        position: { my: "left top+5", at: "left bottom" }
    });
}

async function refreshTables() {
    try {
        // Show loading indicator
        document.body.style.cursor = 'wait';
        $('#laAlchemyTable, #haAlchemyTable').DataTable().destroy();
        $('#laAlchemyTable_wrapper, #haAlchemyTable_wrapper').addClass('opacity-50');

        // Get the latest data
        const { laData, haData } = await processData();
        
        // Repopulate tables with new data
        populateTables(laData, haData);

        // Hide loading indicator
        document.body.style.cursor = 'default';
        $('#laAlchemyTable_wrapper, #haAlchemyTable_wrapper').removeClass('opacity-50');
    } catch (error) {
        console.error('Error refreshing data:', error);
        // Hide loading indicator and show error message
        document.body.style.cursor = 'default';
        $('#laAlchemyTable_wrapper, #haAlchemyTable_wrapper').removeClass('opacity-50');
        alert('Error refreshing data. Please try again.');
    }
}

function parseBankrollInput(input) {
    input = input.toLowerCase().replace(/,/g, '');
    const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
    const match = input.match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/);
    if (match) {
        const [, num, unit] = match;
        return Math.round(parseFloat(num) * (multipliers[unit] || 1));
    }
    return NaN;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function updateAlchCasts() {
    const time = parseInt($('#timeInput').val()) || 0;
    const highAlchCasts = Math.floor((time / 60) * 1200);
    const lowAlchCasts = Math.floor((time / 60) * 2000);
    $('#alchCasts').text(`High Alchemy: ${highAlchCasts} casts | Low Alchemy: ${lowAlchCasts} casts`);
}

function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function initializeInputs() {
    const $bankrollInput = $('#bankrollInput');
    const $timeInput = $('#timeInput');
    const $refreshInputs = $('#refreshInputs');

    // Load values from cookies or set defaults
    const savedBankroll = getCookie('bankroll') || '100,000';
    const savedTime = getCookie('time') || '10';

    // Set initial values
    $bankrollInput.val(savedBankroll);
    $timeInput.val(savedTime);

    // Update alch casts display
    updateAlchCasts();

    // Add event listeners
    $bankrollInput.on('input', function() {
        const value = parseBankrollInput(this.value);
        console.log(value);
        if (!isNaN(value)) {
            this.value = formatNumber(value);
            setCookie('bankroll', this.value, 30); // Save to cookie for 30 days
        }
        updateAlchCasts();
    });

    $timeInput.on('input', function() {
        // Remove the min attribute to allow backspace
        $(this).removeAttr('min');
    });

    $timeInput.on('blur', function() {
        // Reapply the min value when the input loses focus
        let value = parseInt(this.value);
        if (isNaN(value) || value < 1) {
            value = 1;
        } else if (value > 1440) {
            value = 1440;
        }
        this.value = value;
        $(this).attr('min', '1');
        setCookie('time', value, 30); // Save to cookie for 30 days
        updateAlchCasts();
    });

    // Add event listener for the refresh button
    $refreshInputs.on('click', refreshTables);

    // Add event listener for Enter key on both inputs
    $bankrollInput.add($timeInput).on('keypress', function(e) {
        if (e.which === 13) { // 13 is the Enter key
            refreshTables();
        }
    });
}

async function init() {
    try {
        initializeInputs();
        const { laData, haData } = await processData();
        populateTables(laData, haData);

        // Add event listeners for refresh buttons
        $('#refreshLATable, #refreshHATable').on('click', refreshTables);
    } catch (error) {
        console.error('Error fetching or processing data:', error);
    }
}

$(document).ready(init);