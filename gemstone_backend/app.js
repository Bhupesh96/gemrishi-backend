import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import "./cron/orderCleanup.js"  

// Setup
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration
// app.use(
//   cors({
//     // origin: "https://zynotex.com",
//     // origin: "http://localhost:5173",
//     // origin: "https://zynotex.com",
//     origin: process.env.CORS_ORIGIN,
//     credentials: true, // Allow cookies to be sent with requests
//   })
// );


// Convert comma-separated origins from .env into an array
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim())
  : [];

console.log("✅ Allowed CORS Origins:", allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn(`❌ CORS blocked request from: ${origin}`);
      // return callback(new Error("Not allowed by CORS"));
      return res.status(200).json({
        success: false,
        message: "Not allowed by CORS",
      });
    }
  },
  credentials: true, // allow cookies or auth headers
};

// Apply CORS globally
app.use(cors(corsOptions));




// Body Parsers configuration
app.use(express.json({ limit: "10mb" })); // Limiting the size of incoming JSON payloads
app.use(express.urlencoded({ extended: true })); // Limiting the size of URL-encoded form data

app.use(cookieParser());

// Static Files
app.use(express.static("public"));
app.use(
  "/public/uploads",
  express.static(path.join(__dirname, "public/uploads"))
);

// Route Imports
// import superAdminRouter from "./routers/superAdmin.routes.js";
import superAdminRouter from "./routers/superAdmin.routes.js";
import userRoutes from "./routers/user.route.js";
import retailerRoutes from "./routers/retailer.route.js";
import productRoutes from "./routers/product.route.js";
import jewelryRoutes from "./routers/jewelry.route.js";
import orderRoutes from "./routers/order.route.js";
import dashboardRoutes from "./routers/dashboard.route.js";
import categoryRoutes from "./routers/category.route.js";
import adminRouter from "./routers/admin.routes.js";
import subcategoryRoutes from "./routers/subcategory.route.js";
import jewelryCategoryRoutes from "./routers/jewelry.category.route.js";
import jewelrySubCategoryRoutes from "./routers/jewelry.subcategory.route.js";
import recommendedRoutes from "./routers/recommended.routes.js";
import bannerRoutes from "./routers/banner.routes.js";
import refundRoutes from "./routers/refund.routes.js"
import wishlistRoutes from "./routers/wishlist.routes.js"
import reviewRatingRoutes from "./routers/reviewRating.routes.js"
import analyticsRoutes from "./routers/analytics.route.js"
import cartRoutes from "./routers/cart.routes.js"
import metalRates from "./routers/metalRates.routes.js"
import originCountryMap from "./routers/originCountryMap.routes.js"
import retailerCartRoutes from "./routers/retailerCart.routes.js"
import emailSubRoutes from "./routers/emailSub.routes.js"
import buyBackReqRoutes from "./routers/buy.back.req.route.js"
import offerRoutes from "./routers/offer.routes.js"
import contactUsRoutes from "./routers/contactUs.route.js"





//& Color codes for console output
const reset = "\x1b[0m"; // Reset
const green = "\x1b[32m"; // Green
const red = "\x1b[31m"; // Red
const skyblue = "\x1b[94m"; // Sky Blue
const cyan = "\x1b[36m"; // Cyan
const yellow = "\x1b[33m"; // Yellow
const magenta = "\x1b[35m"; // Magenta

// const colors = {
// 	GET: "\x1b[36m", // Cyan
// 	POST: "\x1b[32m", // Green
// 	PUT: "\x1b[35m", // Mangenta
// 	DELETE: "\x1b[31m", // Red
// 	PATCH: "\x1b[33m", // Yellow
// 	DEFAULT: "\x1b[0m", // Reset
// };

// const logMiddleware = (req, res, next) => {
// 	const color = colors[req.method] || colors.DEFAULT;
// 	const reset = colors.DEFAULT;

// 	logger.info({
// 		message: ${color}${req.method} Request received${reset},
// 		method: ${color}${req.method}${reset},
// 		url: ${color}${req.originalUrl}${reset},
// 		status: ${color}${res.statusCode}${reset},
// 		headers: ${color}${JSON.stringify(req.headers, null, 2)}${reset},
// 		params: ${color}${JSON.stringify(req.params, null, 2)}${reset},
// 		query: ${color}${JSON.stringify(req.query, null, 2)}${reset},
// 		formdata: ${color}${JSON.stringify(req.files, null, 2)}${reset},
// 	});

// 	const originalSend = res.send;
// 	res.send = function (body) {
// 		logger.info({
// 			message: ${color}${req.method} Response sent${reset},
// 			status: ${color}${res.statusCode}${reset},
// 			body: `${color}${
// 				typeof body === "object" ? JSON.stringify(body, null, 2) : body
// 			}${reset}`,
// 		});
// 		originalSend.call(this, body);
// 	};
// 	next();
// };
// app.use(logMiddleware);

// console lgging request details
// Request Logging Middleware
app.use((req, res, next) => {
  const methodColors = {
    GET: "\x1b[32m", // Green
    POST: "\x1b[36m", // Cyan
    PATCH: "\x1b[33m", // Yellow
    PUT: "\x1b[35m", // Magenta
    DELETE: "\x1b[31m", // Red
    DEFAULT: "\x1b[0m", // Reset
  };

  const reset = "\x1b[0m"; // Reset
  const color = methodColors[req.method] || methodColors.DEFAULT;

  res.on("finish", () => {
    let statusColor = "\x1b[32m"; // Green by default
    if (res.statusCode >= 500) statusColor = "\x1b[31m"; // Red
    else if (res.statusCode >= 400) statusColor = "\x1b[33m"; // Yellow

    console.log(
      `${skyblue}[${new Date().toISOString()}]${reset} ${statusColor}[${
        res.statusCode
      }]${reset} ${color}${req.method}${reset}\t ${statusColor}${
        req.originalUrl
      }${reset}`
    );
    // console.log(`${skyblue}[${new Date().toISOString()}]${reset} ${statusColor}[${res.statusCode}]${reset} ${color}${req.method}${reset}\t ${statusColor}${req.originalUrl}${reset}\t ${req.ip} - ${req.get('User-Agent')}`);
    // console.log(`${skyblue}[${new Date().toISOString()}]${reset} ${statusColor}[${res.statusCode}]${reset} ${color}${req.method}${reset}\t ${statusColor}${req.originalUrl}${reset}\t ${res.statusCode != 404 ? `${green}OK` : `${red}Endpoint Not Found`}${reset}`);
  });

  next();
});

// API Status Checking URL
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    server: "Gemstone Backend Server",
    status: "OK",
    branch: "Master Branch",
    version: "1.0.0",
    date: new Date().toISOString(),
    message: "API Server is up and running!",
  });
});

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});


// Route Declarations
const apiVersion = "/api/v1";
app.use(`${apiVersion}/superAdmin`, superAdminRouter); // Not Using
app.use(`${apiVersion}/admin`, adminRouter);

app.use("/api/v1/superAdmin", superAdminRouter);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/retailer", retailerRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/jewelry", jewelryRoutes);
app.use("/api/v1/order", orderRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/category", categoryRoutes);
app.use("/api/v1/subcategory", subcategoryRoutes);
app.use("/api/v1/jewelryCategory", jewelryCategoryRoutes);
app.use("/api/v1/jewelrySubCategory", jewelrySubCategoryRoutes);
app.use("/api/v1/recommended", recommendedRoutes);
app.use("/api/v1/banner", bannerRoutes);
app.use("/api/v1/refund", refundRoutes)
app.use("/api/v1/wishlist", wishlistRoutes)
app.use("/api/v1/reviewRating", reviewRatingRoutes);
app.use("/api/v1/analytics", analyticsRoutes)
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/metalRates", metalRates);
app.use("/api/v1/originCountryMap", originCountryMap);
app.use("/api/v1/retailerCart", retailerCartRoutes);
app.use("/api/v1/emailSub", emailSubRoutes);
app.use("/api/v1/buyBackReq", buyBackReqRoutes);
app.use("/api/v1/offer", offerRoutes);
app.use("/api/v1/contactUs", contactUsRoutes);




// 404 Handler
app.use((req, res, next) => {
  console.log(
    `${skyblue}[${new Date().toISOString()}]${reset} ${red}[${
      res.statusCode
    }] ${req.method}\t ${req.originalUrl}\t\t<-- * Endpoint Not Found${reset}`
  );
  return res.status(404).json({
    success: false,
    message: "Endpoint not found!",
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.log(
    `${skyblue}[${new Date().toISOString()}]${reset} ${red}[${
      res.statusCode
    }] ${req.method}\t ${
      req.originalUrl
    }\t\t<-- * Something Went Wrong Here${reset}`
  );
  console.error(err.status);
  console.error(err.message);
  console.error(err.stack);
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: "Internal Server Error",
  });
});

export default app;

//& 201 is the status code for created
//& 400 is the status code for bad request
//& 500 is the status code for internal server error
//& 404 is the status code for not found
//& 401 is the status code for unauthorized
//& 403 is the status code for forbidden
//& 409 is the status code for conflict(duplicate entries)
//& 200 is the status code for success
//& 202 is the status code for accepted
//& 204 is the status code for no content
//& 422 is the status code for unprocessable entity
//& 523 is the status code for service down
