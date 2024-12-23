document.addEventListener('DOMContentLoaded', function() {
    // Define filter elements
    const songFilter = document.getElementById('songFilter');
    const ppMinFilter = document.getElementById('ppMinFilter');
    const ppMaxFilter = document.getElementById('ppMaxFilter');
    const bpmMinFilter = document.getElementById('bpmMinFilter');
    const bpmMaxFilter = document.getElementById('bpmMaxFilter');
    const lengthMinFilter = document.getElementById('lengthMinFilter');
    const lengthMaxFilter = document.getElementById('lengthMaxFilter');
    const accMinFilter = document.getElementById('accMinFilter');
    const accMaxFilter = document.getElementById('accMaxFilter');

    // Define mod opposites
    const modOpposites = {
        'DT': 'HT',
        'HR': 'EZ'
    };

    // Track mod states: 1 = must have, 2 = must not have, 3 = opposite mod, 0 = neutral
    const modStates = new Map();
    let allMaps = [];  // Store all maps
    let filteredMaps = [];  // Store filtered maps
    let currentDisplayCount = 100;  // Initial display count

    // Fetch all maps initially
    fetch('/load_more?page=all')
        .then(response => response.json())
        .then(maps => {
            allMaps = maps;
            filteredMaps = maps;
            displayMaps(0, currentDisplayCount);
        });

    // Add event listeners to all filters
    [songFilter, ppMinFilter, ppMaxFilter, bpmMinFilter, bpmMaxFilter,
     lengthMinFilter, lengthMaxFilter, accMinFilter, accMaxFilter
    ].forEach(filter => filter?.addEventListener('input', applyFilters));

    // Add click handlers for mod buttons
    document.querySelectorAll('.mod-button').forEach(button => {
        button.addEventListener('click', () => {
            const mod = button.dataset.mod;
            
            // Get current state (0 if not set)
            const currentState = modStates.get(mod) || 0;
            let newState = currentState + 1;
            if (newState > 3) newState = 0;
            
            // Update button appearance
            button.classList.remove('active', 'excluded', 'opposite');
            
            switch(newState) {
                case 1: // Must have mod
                    button.classList.add('active');
                    button.style.backgroundColor = getModColor(mod);
                    button.style.color = 'white';
                    break;
                case 2: // Must not have mod
                    button.classList.add('excluded');
                    button.style.backgroundColor = '#ff0000';
                    button.style.color = 'white';
                    break;
                case 3: // Must have opposite mod
                    if (modOpposites[mod]) {
                        button.classList.add('opposite');
                        button.style.backgroundColor = '#44aadd';
                        button.style.color = 'white';
                        button.textContent = modOpposites[mod];
                    } else {
                        newState = 0;
                        resetButtonStyle(button, mod);
                    }
                    break;
                default: // Neutral state
                    resetButtonStyle(button, mod);
                    break;
            }
            
            // Update state
            if (newState === 0) {
                modStates.delete(mod);
            } else {
                modStates.set(mod, newState);
            }
            
            applyFilters();
        });
    });

    function applyFilters() {
        const searchTerm = songFilter.value.toLowerCase();
        const ppMin = parseFloat(ppMinFilter.value) || 0;
        const ppMax = parseFloat(ppMaxFilter.value) || Infinity;
        const bpmMin = parseFloat(bpmMinFilter.value) || 0;
        const bpmMax = parseFloat(bpmMaxFilter.value) || Infinity;
        const lengthMin = parseFloat(lengthMinFilter.value) || 0;
        const lengthMax = parseFloat(lengthMaxFilter.value) || Infinity;
        const accMin = parseFloat(accMinFilter.value) || 0;
        const accMax = parseFloat(accMaxFilter.value) || 100;

        filteredMaps = allMaps.filter(map => {
            const songMatch = !searchTerm || map.map_name.toLowerCase().includes(searchTerm);
            const pp = parseFloat(map.average_pp);
            const bpm = parseFloat(map.bpm);
            const length = parseInt(map.formatted_length.split(':')[0]) * 60 + 
                          parseInt(map.formatted_length.split(':')[1]);
            const accuracy = parseFloat(map.formatted_accuracy);
            
            const ppMatch = pp >= ppMin && pp <= ppMax;
            const bpmMatch = bpm >= bpmMin && bpm <= bpmMax;
            const lengthMatch = length >= lengthMin && length <= lengthMax;
            const accMatch = accuracy >= accMin && accuracy <= accMax;
            
            const modsMatch = Array.from(modStates.entries()).every(([mod, state]) => {
                switch(state) {
                    case 1: return map.mods.includes(mod);
                    case 2: return !map.mods.includes(mod);
                    case 3: return map.mods.includes(modOpposites[mod] || '');
                    default: return true;
                }
            });

            return songMatch && ppMatch && bpmMatch && lengthMatch && accMatch && modsMatch;
        });

        // Reset display
        currentDisplayCount = 100;
        const tbody = document.querySelector('#mapsTable tbody');
        tbody.innerHTML = '';
        displayMaps(0, currentDisplayCount);
    }

    function displayMaps(start, end) {
        const tbody = document.querySelector('#mapsTable tbody');
        const mapsToShow = filteredMaps.slice(start, end);
        
        // Clear tbody only if starting from beginning
        if (start === 0) {
            tbody.innerHTML = '';
        }
        
        mapsToShow.forEach((map, index) => {
            const row = createMapRow(map, start + index + 1);
            tbody.appendChild(row);
        });
    }

    // Infinite scroll
    window.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        if (scrollTop + clientHeight >= scrollHeight - 200 && 
            currentDisplayCount < filteredMaps.length) {
            const nextBatch = 100;
            const start = currentDisplayCount;
            currentDisplayCount += nextBatch;
            displayMaps(start, currentDisplayCount);
        }
    });

    function getModColor(mod) {
        switch(mod) {
            case 'DT': return '#ffcc21';
            case 'HD': return '#ffcc21';
            case 'HR': return '#ffcc21';
            case 'FL': return '#ffcc21';
            default: return '#ffffff';
        }
    }

    function resetButtonStyle(button, mod) {
        button.style.backgroundColor = '';
        button.style.color = '';
        button.textContent = mod;
    }

    function createMapRow(map, index) {
        const tr = document.createElement('tr');
        
        // Add click event to go to beatmap page
        tr.addEventListener('click', (e) => {
            // Don't trigger if clicking on links or buttons
            if (!e.target.closest('a') && !e.target.closest('button')) {
                window.open(`https://osu.ppy.sh/beatmaps/${map.beatmap_id}`, '_blank');
            }
        });

        // Clean up map name: trim whitespace and replace multiple spaces/newlines with single space
        const cleanMapName = map.map_name.replace(/\s+/g, ' ').trim();
        
        tr.innerHTML = `<td class="row-number">${index}</td>
            <td class="map-cell">
                <img src="${map.thumbnail}" alt="Beatmap Thumbnail" class="map-thumbnail">
                <div class="map-info">
                    <div class="map-name">
                        <a href="https://osu.ppy.sh/beatmaps/${map.beatmap_id}" target="_blank">${cleanMapName}</a>
                    </div>
                    <div class="map-details">
                        <span class="map-type ${map.map_type}">${map.map_type}</span>
                        <a href="osu://b/${map.beatmap_id}" class="download-button">
                            <svg class="download-icon" viewBox="0 0 24 24">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                            </svg>
                            osu!direct
                        </a>
                    </div>
                </div>
            </td>
            <td class="pp-cell">${Math.round(map.average_pp)}pp</td>
            <td>
                <div class="mod-container">
                    ${map.mods.split(' ').map(mod => `<span class="mod-box mod-${mod}">${mod}</span>`).join('')}
                </div>
            </td>
            <td class="length-cell">${map.formatted_length}</td>
            <td class="bpm-cell">${map.bpm}</td>
            <td class="accuracy-cell">${map.formatted_accuracy}</td>
            <td class="farmability-cell">${map.mod_count}</td>`;
        return tr;
    }
}); 