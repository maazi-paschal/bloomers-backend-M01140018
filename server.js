const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({path: "./config.env"});
const {MongoClient, ObjectId} = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});