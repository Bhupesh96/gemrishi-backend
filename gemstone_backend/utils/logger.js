const { createLogger, format } = require("winston");
const winston = require("winston");

const logger = createLogger({
    level: "info",
    format: format.combine(
        format.colorize({ all: true }),
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.printf(
            (info) =>
                `${info.timestamp} [${info.level}]: ${info.message}` +
                (info.method ? ` - method: ${info.method}` : "") +
                (info.url ? ` | url: ${info.url}` : "") +
                // (info.params ? ` | params: ${info.params}` : "") +
                // (info.query ? ` | query: ${info.query}` : "") +
                (info.body ? ` - body: ${info.body}` : "") +
                // (info.formdata ? ` | formdata: ${info.formdata}` : "") +
                (info.status ? ` | status: ${info.status}` : "")
        )
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: "logs/error/error.log",
            level: "error",
        }),
        new winston.transports.File({
            filename: "logs/combinedlog.log",
            maxFiles: 2048,
            maxFiles: 1,
        }),
    ],
});

module.exports = logger;
