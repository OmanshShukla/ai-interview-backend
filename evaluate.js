const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const evaluateAnswer = require("./evaluate");
const Interview = require("./models/Interview");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());


// 🔹 MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/interviewDB")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));


// 🔹 Test Route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});


// 🔥 STEP 2: UPDATED EVALUATE API (WITH SAVE)
app.post("/evaluate", async (req, res) => {
  try {
    const { question, answer } = req.body;

    // Validation
    if (!question || !answer) {
      return res.status(400).json({
        error: "Question and Answer are required"
      });
    }

    // Call AI
    const result = await evaluateAnswer(question, answer);

    // 🔥 SAVE TO DATABASE
    const newEntry = new Interview({
      question,
      answer,
      score: result.score,
      feedback: result.feedback
    });

    await newEntry.save();

    // Send response
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Server error"
    });
  }
});


// 🔹 HISTORY API
app.get("/history", async (req, res) => {
  try {
    const history = await Interview.find().sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});


// 🔹 Start Server
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});