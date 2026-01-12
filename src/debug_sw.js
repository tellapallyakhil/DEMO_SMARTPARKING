try {
    console.log('Loading vehicle model...');
    require('./models/vehicle.model');
    console.log('Loading graph model...');
    require('./models/graph.model');
    console.log('Loading slot model...');
    require('./models/slot.model');
    console.log('Loading dijkstra...');
    require('./algorithms/dijkstra');
    console.log('Loading modified dijkstra...');
    require('./algorithms/modifiedDijkstra');
    console.log('Loading rfid controller...');
    require('./controllers/rfid.controller');
    console.log('All modules loaded successfully.');
} catch (error) {
    console.error('ERROR LOADING MODULE:');
    console.error(error);
}
