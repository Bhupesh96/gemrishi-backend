import dotenv from 'dotenv'
dotenv.config()
import http from 'http';
import app from './app.js'
import ioHandler from './socket.js';   // socket setup file
import databaseconnection from "./db/connection.db.js";
import "./cron/orderCleanup.js";  


import os from 'os'; // Import the os module
const server = http.createServer(app);
// ioHandler(server);           //<-- socket.io setup file

const green = '\x1b[32m';    // Green
const red = '\x1b[31m';      // Red
const cyan = '\x1b[36m';     // Cyan
const magenta = '\x1b[35m';  // Magenta
const reset = '\x1b[0m';     // Reset

console.log(`\n\n${cyan}Gemstone Backend Server (Master Branch)\nRunning In Production Environment${reset}\n`);

databaseconnection()
    .then(() => {
        process.stdout.write(`${green}Starting Server......${reset}`);
        server.listen(process.env.PORT, () => {
            console.log(`${green}Server is running on port: ${magenta}${process.env.PORT}${reset}`);
            // console.log(`${green}Server Socket.IO is running on port: ${magenta}${process.env.PORT}${reset}\n`);

            // Get the IP address of the computer
            printNetworkInfo(process.env.PORT);
            console.log(`\n${green}Server Started Successfully......${reset}\n`);
        });
        process.stdout.write('\r\x1b[K'); // \r moves to start, \x1b[K clears the line
    })

    .catch((error) => {
        console.error(`${red}Mongodb Connection Failed !!!${reset}`, error);
    })


// Function to get the IP address of the computer
function printNetworkInfo(port) {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }

    console.log(`\n${green}Server IP Address:${reset}`);
    console.log(`${green}➜  Local:   ${cyan}http://localhost:${magenta}${port}${reset}`);
    addresses.forEach((addr) => {
        console.log(`${green}➜  Network: ${cyan}http://${addr}:${magenta}${port}${reset}`);
    });
}


