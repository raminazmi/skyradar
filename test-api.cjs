const axios = require('axios');

async function testOpenMeteo() {
    const resolution = 10;
    const bounds = { north: 30, south: 20, east: 50, west: 40 };
    const lats = [];
    const lons = [];
    const stepLat = (bounds.north - bounds.south) / (resolution - 1);
    const stepLon = (bounds.east - bounds.west) / (resolution - 1);

    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            lats.push(Number((bounds.north - i * stepLat).toFixed(4)));
            lons.push(Number((bounds.west + j * stepLon).toFixed(4)));
        }
    }

    console.log(`Testing ${lats.length} points...`);
    
    try {
        const start = Date.now();
        const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude: lats.join(','),
                longitude: lons.join(','),
                hourly: 'temperature_2m',
                models: 'gfs_seamless',
                forecast_days: 1
            }
        });
        
        console.log(`Success in ${Date.now() - start}ms!`);
        console.log(`Response is array: ${Array.isArray(response.data)}`);
        console.log(`Response length: ${Array.isArray(response.data) ? response.data.length : 'N/A'}`);
    } catch (e) {
        console.error('API Error:');
        if (e.response) {
            console.error(e.response.status, e.response.data);
        } else {
            console.error(e.message);
        }
    }
}

testOpenMeteo();
