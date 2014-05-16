var static = require('node-static');

//
// Create a node-static server instance to serve the 'tests/html' folder
//
var file = new static.Server('./tests/html');

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        file.serve(request, response);
    }).resume();
}).listen(8000);
