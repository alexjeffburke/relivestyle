const path = require("path");
// const express = require('express');

// const relivestyleHandler = require('../lib/handlers/static');

// const app = express();

// app.use(relivestyleHandler({ servePath: path.join(__dirname, 'example-project') }));

// app.listen(7000);

const Server = require("../lib/Server");

const server = new Server({
    servePath: path.join(__dirname, "example-project")
});

server.listen(7000);
