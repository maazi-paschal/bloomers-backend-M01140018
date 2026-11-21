const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: "./config.env" });
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

//global logger middleware to see incoming requests (writing it here because if it is down, the request will be executed before it can be logged)
app.use((req, res, next) => {
  console.log(
    `There's an incoming ${req.method} request to ${req.url} at ${new Date().toLocaleTimeString()}`,
  );
  next();
});

// Serve static files from the "public/images" directory when the URL starts with "/images"
const imagesPath = path.join(__dirname, "public", "images");
app.use("/images", express.static(imagesPath));

//If no file was found in the images folder, return a 404 error with a JSON response
app.use("/images", (req, res) => {
  res.status(404).json({ error: "Image not found" });
});

// connection to MongoDB Atlas
const uri =
  process.env.MONGODB_PREFIX +
  process.env.MONGODB_USERNAME +
  ":" +
  process.env.MONGODB_PASSWORD +
  process.env.MONGODB_URL;

const client = new MongoClient(uri);
let db;

async function connecttoMongoDB() {
  try {
    await client.connect();
    db = client.db("bloomers");
    console.log("Successfully connected to database");
  } catch (error) {
    console.error("Error connecting to MongoDB Atlas:", error);
  }
}

connecttoMongoDB();

//GET all lessons from the "lessons" collection in my MongoDB database and return them as a JSON response
app.get("/lessons", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected yet" });
    }

    const lessons = await db.collection("lessons").find({}).toArray();
    res.status(200).json(lessons);
  } catch (error) {
    console.error("Error fetching lessons:", error);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

//Helper to escape special characters in a string for use in a regular expression
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//Searching lessons across text and numeric fields
app.get("/search", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected yet" });
    }

    const rawQuery = (req.query.q || "").trim();

    //if no search term is provided, just return all lessons
    if (!rawQuery) {
      const allLessons = await db.collection("lessons").find({}).toArray();
      return res.status(200).json(allLessons);
    }

    const safePattern = new RegExp(escapeRegex(rawQuery), "i"); // case-insensitive search
    const conditions = [
      { topic: safePattern },
      { location: safePattern },
      { teacherFirstName: safePattern },
      { teacherLastName: safePattern },
    ];

    //If the query is a valid number, also match exact price or space values
    const numericQuery = Number(rawQuery);
    if (!Number.isNaN(numericQuery)) {
      conditions.push({ price: numericQuery }, { space: numericQuery });
    }

    const results = await db
      .collection("lessons")
      .find({ $or: conditions })
      .toArray();

    res.status(200).json(results);
  } catch (error) {
    console.error("Error searching lessons:", error);
    res.status(500).json({ error: "Failed to search lessons" });
  }
});

app.post("/orders", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected yet" });
    }
    const { name, countryCode, phone, lessonIDs, spaces } = req.body;

    //To validate the input data
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Customer name is required" });
    }
    if (!countryCode || !String(countryCode).trim()) {
      return res.status(400).json({ error: "Country code is required" });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    if (!Array.isArray(lessonIDs) || lessonIDs.length === 0) {
      return res.status(400).json({ error: "At least one lesson is required" });
    }

    const spacesCount = Number(spaces);
    if (Number.isNaN(spacesCount) || spacesCount < 1) {
      return res.status(400).json({ error: "Spaces must be more than 1" });
    }

    const cleanName = String(name).trim();
    const rawCountryCode = String(countryCode).trim();
    const cleanCountryCode = rawCountryCode.startsWith("+")
      ? rawCountryCode
      : `+${rawCountryCode}`;
    const cleanPhone = String(phone).trim();

    const newOrder = {
      name: cleanName,
      countryCode: cleanCountryCode,
      phone: cleanPhone,
      fullPhone: `${cleanCountryCode} ${cleanPhone}`,
      lessonIDs,
      spaces: spacesCount,
      createdAt: new Date().toISOString(),
    };

    // Save the new order to the database
    const result = await db.collection("orders").insertOne(newOrder);

    res
      .status(201)
      .json({
        message: "Order created successfully",
        orderId: result.insertedId,
        order: newOrder,
      });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
