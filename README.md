# **Bloomers Backend API**

Express.js and native MongoDB driver backend for **Bloomers**, an after-school activities booking platform for learners aged 8-15 across Mauritius.

Built for Middlesex University Mauritius coursework requirements (along with selected enhancements).


## **Project Links**
- **Express Backend GitHub Repository:** `https://github.com/maazi-paschal/bloomers-backend-M01140018`
- **Render Live `/lessons` Endpoint:** `https://M01140018-bloomers.onrender.com/lessons`
- **Vue Frontend GitHub Repository:** `https://github.com/maazi-paschal/bloomers-frontend-M01140018`
- **GitHub Pages Live Frontend:** `https://maazi-paschal.github.io/bloomers-frontend-M01140018`


## **Tech Stack & Dependencies**
- **Runtime & Framework:** Node.js, Express.js (`express`)
- **Database:** MongoDB Atlas (`bloomers` database, `lessons` and `orders` collections) using the native `mongodb` driver
- **Middleware & Utilities:** `cors`, `dotenv`, `path`, `nodemon` (dev)


## **Environment Configuration (`config.env`)**
Create a `config.env` file in the root of `bloomers-backend` (ignored by Git via `.gitignore`):


```env
PORT=3000
MONGODB_PREFIX=mongodb+srv://
MONGODB_USERNAME=<your-atlas-username>
MONGODB_PASSWORD=<your-atlas-password>
MONGODB_URL=@cluster0.xxxxx.mongodb.net/
```


## **Running Locally**
1. Install Dependencies: `npm install`
2. Start the server: `node server.js` (OR like I did, use `npx nodemon server.js` during **development**)
3. Server listens on `http://localhost:3000` (or `process.env.PORT` when deployed).


## **Middleware & Static Images**
- **Request Logger:** Logs incoming HTTP method, URL, and timestamp to the console for every request.
- **Static Images:** Serves images from `public/images/` under `/images/<filename>`, returning a `404` JSON response (`{ "error": "Image not found" }`) when a file does not exist.


## **API Endpoints**
- `GET /lessons` - Returns all lessons from `bloomers.lessons`.
- `GET /search?q=<term>` - Searches lessons by `topic`, `location`, `teacherFirstName`, `teacherLastName`, or exact `price` / `space` value.
- `POST /orders` - Validates customer details (`name`, `countryCode`, `phone`), `lessonIDs`, and `spaces`, checks lesson existence and available `space` in `bloomers.lessons`, and saves the order to `bloomers.orders`.
- `PUT /lessons/:id` - Updates the remaining `space` count for a lesson in `bloomers.lessons`.
- `GET /enrolment/:lessonid` - Returns the total number of enrolled/purchased spaces for the specified lesson ID from `bloomers.orders`.