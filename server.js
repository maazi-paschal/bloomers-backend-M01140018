const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({path: "./config.env"});
const {MongoClient, ObjectId} = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

//global logger middleware to see incoming requests (writing it here because if it is down, the request will be executed before it can be logged)
app.use((req, res, next) => {
    console.log(`There's an incoming ${req.method} request to ${req.url} at ${new Date().toLocaleTimeString()}`);
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
const uri = process.env.MONGODB_PREFIX + process.env.MONGODB_USERNAME + ":" + process.env.MONGODB_PASSWORD + process.env.MONGODB_URL;

const client = new MongoClient(uri);
let db;

async function connecttoMongoDB(){
    try{
        await client.connect();
        db = client.db("bloomers");
        console.log("Successfully connected to MongoDB Atlas");
    } catch (error) {
        console.error("Error connecting to MongoDB Atlas:", error);
    }
}

connecttoMongoDB();

//GET all lessons from the "lessons" collection
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});