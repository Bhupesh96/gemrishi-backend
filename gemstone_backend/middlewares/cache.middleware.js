import redisClient from "../config/redis.js";

export const cacheMiddleware = (keyPrefix) => async (req, res, next) => {
  try {
    const key = `${keyPrefix}:${req.originalUrl || req.url}`;

    const cachedData = await redisClient.get(key);
    if (cachedData) {
      console.log("Cache Hit:", key);
      return res.status(200).json(JSON.parse(cachedData));
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        redisClient.setEx(key, 3600, JSON.stringify(body)); // cache 1h
      } catch (err) {
        console.error("Redis cache set error:", err);
      }
      originalJson(body);
    };

    next();
  } catch (err) {
    console.error("Cache middleware error:", err);
    next();
  }
};
