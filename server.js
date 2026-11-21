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

// POST /orders endpoint to create a new order/booking in the "orders" collection of my Database
app.post("/orders", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected yet" });
    }

    const { name, countryCode, phone, lessonIDs, spaces } = req.body;

    // To validate the input data
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
    if (!Number.isInteger(spacesCount) || spacesCount < 1) {
      return res
        .status(400)
        .json({ error: "Spaces must be a whole number of at least 1" });
    }

    //Normalize lessonIDs to ensure they are numbers and check for invalid IDs
    const normalizedLessonIDs = lessonIDs.map((id) => Number(id));
    if (normalizedLessonIDs.some((id) => Number.isNaN(id))) {
      return res
        .status(400)
        .json({ error: "All lesson IDs must be valid numbers" });
    }

    //To count how many times each lesson ID appears in lesson IDs
    const occurrencesByLessonID = new Map();
    for (const id of normalizedLessonIDs) {
      occurrencesByLessonID.set(id, (occurrencesByLessonID.get(id) || 0) + 1);
    }

    const uniqueLessonIDs = [...occurrencesByLessonID.keys()];
    const matchingLessons = await db
      .collection("lessons")
      .find({ id: { $in: uniqueLessonIDs } })
      .toArray();

    const lessonsById = new Map(
      matchingLessons.map((lesson) => [lesson.id, lesson]),
    );

    // My first identified edge case: Checking that evry requested lesson ID exists in the database
    for (const lessonID of uniqueLessonIDs) {
      if (!lessonsById.has(lessonID)) {
        return res
          .status(400)
          .json({ error: `Lesson with ID ${lessonID} was not found` });
      }
    }

    // My second & third identified edge case: Checking that no lesson is sold out and enough spaces exist for each requested lesson
    for (const [id, countInOrder] of occurrencesByLessonID.entries()) {
      const lesson = lessonsById.get(id);
      const availableSpace = Number(lesson.space ?? 0);
      const neededSpaces = spacesCount * countInOrder;

      if (availableSpace <= 0) {
        return res
          .status(400)
          .json({ error: `${lesson.topic} has no spaces available` });
      }

      if (availableSpace < neededSpaces) {
        return res.status(400).json({
          error: `Only ${availableSpace} space(s) available for ${lesson.topic}. Requested: ${neededSpaces}`,
        });
      }
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
      lessonIDs: normalizedLessonIDs,
      spaces: spacesCount,
      createdAt: new Date().toISOString(),
    };

    // Save the new order to the database
    const result = await db.collection("orders").insertOne(newOrder);

    res.status(201).json({
      message: "Order created successfully",
      orderId: result.insertedId,
      order: newOrder,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

//PUT /lessons/:id endpoint to update the remaining space count for a lesson in the database
app.put("/lessons/:id", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected yet" });
    }

    const lessonId = Number(req.params.id);
    if (Number.isNaN(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    //Validate the request body to ensure that the space count is provided and is a valid number
    if (req.body.space === undefined) {
      return res
        .status(400)
        .json({ error: "Please provide the updated space count" });
    }

    const updatedSpace = Number(req.body.space);
    if (Number.isNaN(updatedSpace) || updatedSpace < 0) {
      return res
        .status(400)
        .json({ error: "Space must be a valid number of 0 or more" });
    }

    const result = await db
      .collection("lessons")
      .updateOne({ id: lessonId }, { $set: { space: updatedSpace } });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const updatedLesson = await db
      .collection("lessons")
      .findOne({ id: lessonId });
    res.status(200).json({
      message: "Lesson space updated successfully",
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error("Error updating lesson space:", error);
    res.status(500).json({ error: "Failed to update lesson space" });
  }
});

//GET /enrolment/:lessonid endpoint to retrieve all enrolled spaces for a specific lesson from the "orders" collection in the database
app.get("/enrolment/:lessonid", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected yet" });
    }

    const targetLessonId = Number(req.params.lessonid);
    if (Number.isNaN(targetLessonId)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    const lesson = await db
      .collection("lessons")
      .findOne({ id: targetLessonId });
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const matchingOrders = await db
      .collection("orders")
      .find({ lessonIDs: targetLessonId })
      .toArray();

    let totalEnrolledSpaces = 0;
    for (const order of matchingOrders) {
      const orderLessonIDs = Array.isArray(order.lessonIDs)
        ? order.lessonIDs
        : [];
      const occurrencesInOrder = orderLessonIDs.filter(
        (id) => Number(id) === targetLessonId,
      ).length;
      const orderSpaces = Number(order.spaces || 0);
      totalEnrolledSpaces += occurrencesInOrder * orderSpaces;
    }

    res.status(200).json({
      lessonId: targetLessonId,
      topic: lesson.topic,
      totalEnrolledSpaces: totalEnrolledSpaces,
      availableSpaces: lesson.space,
    });
  } catch (error) {
    console.error("Error fetching enrolment data:", error);
    res.status(500).json({ error: "Failed to fetch lesson enrolment data" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
