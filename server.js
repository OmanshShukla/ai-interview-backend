const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const SECRET = "secret123";

// 🔹 MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/interviewDB")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));


// 🔹 USER MODEL
const userSchema = new mongoose.Schema({
  email: String,
  password: String
});
const User = mongoose.model("User", userSchema);


// 🔹 INTERVIEW MODEL
const interviewSchema = new mongoose.Schema({
  question: String,
  answer: String,
  score: Number,
  feedback: String,
  userId: String,
  createdAt: { type: Date, default: Date.now }
});
const Interview = mongoose.model("Interview", interviewSchema);


// 🔹 AUTH MIDDLEWARE
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) return res.status(403).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};


// 🔥 HYBRID AI FUNCTION
const evaluateAnswer = async (question, answer) => {

  // 🔹 PRODUCTION (Render) → fallback
  if (process.env.NODE_ENV === "production") {
    return {
      score: 8,
      feedback: "Good answer (AI disabled in deployed version)"
    };
  }

  // 🔹 LOCAL (Ollama Llama3)
  try {
    const prompt = `
You are a technical interviewer.

Evaluate the answer:

Question: ${question}
Answer: ${answer}

Give output STRICTLY in JSON:
{
  "score": number (0-10),
  "feedback": "short feedback"
}
`;

    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3",
      prompt: prompt,
      stream: false
    });

    const text = response.data.response;

    try {
      return JSON.parse(text);
    } catch {
      return {
        score: 7,
        feedback: text
      };
    }

  } catch (error) {
    console.error("LLAMA ERROR:", error);
    return {
      score: 5,
      feedback: "AI evaluation failed"
    };
  }
};


// 🔹 TEST ROUTE
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});


// 🔹 REGISTER
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ error: "User exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({ email, password: hashed });
    await user.save();

    res.json({ message: "Registered successfully" });

  } catch {
    res.status(500).json({ error: "Server error" });
  }
});


// 🔹 LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign({ id: user._id }, SECRET);

    res.json({ token });

  } catch {
    res.status(500).json({ error: "Server error" });
  }
});


// 🔥 PROTECTED EVALUATE
app.post("/evaluate", verifyToken, async (req, res) => {
  try {
    const { question, answer } = req.body;

    const result = await evaluateAnswer(question, answer);

    const entry = new Interview({
      question,
      answer,
      score: result.score,
      feedback: result.feedback,
      userId: req.user.id
    });

    await entry.save();

    res.json({ success: true, data: result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// 🔹 HISTORY
app.get("/history", verifyToken, async (req, res) => {
  try {
    const data = await Interview.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.json(data);

  } catch {
    res.status(500).json({ error: "Error fetching history" });
  }
});


// 🔥 PORT FIX (IMPORTANT FOR DEPLOYMENT)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});