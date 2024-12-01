require("dotenv").config({path: "./backend/.env"});

const path = require('path');
console.log("Current directory:", __dirname);
console.log("ENV file path:", path.join(__dirname, '.env'));
console.log("Environment variables:", process.env);

const config = require("./config.json");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const upload = require("./multer");
const fs = require("fs");


const { authenticateToken } = require("./utilities");

console.log("JWT Secret:", process.env.ACCESS_TOKEN_SECRET);
// Express app setup
const app = express();

// Middleware
app.use(express.json());
app.use(cors({ 
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Database connection
mongoose.connect(config.connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: true,
  retryWrites: true,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
});

// Models
const User = require("./models/user.model");
const Caption = require("./models/caption.model");

// Routes-routes
const createAccount = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ 
        error: true, 
        message: "All fields are required" 
      });
    }

    const isUser = await User.findOne({ email });
    if (isUser) {
      return res.status(400).json({ 
        error: true, 
        message: "User already exists" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    await user.save();

    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "72h" }
    );

    return res.status(201).json({
      error: false,
      user: { fullName: user.fullName, email: user.email },
      accessToken,
      message: "Registration Successful",
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: true,
      message: "An error occurred during registration"
    });
  }
};
const login = async (req, res) => {
  try {
      const { email, password } = req.body;

      // Debug log
      console.log('Login attempt:', { email });

      if (!email || !password) {
          return res.status(400).json({
              error: true,
              message: "Email and password are required"
          });
      }

      const user = await User.findOne({ email });
      
      // Debug log
      console.log('User found:', !!user);

      if (!user) {
          return res.status(404).json({
              error: true,
              message: "User not found"
          });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      // Debug log
      console.log('Password valid:', isPasswordValid);

      if (!isPasswordValid) {res
          return res.status(401).json({
              error: true,
              message: "Invalid password"
          });
      }

      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.ACCESS_TOKEN_SECRET,
        { 
          expiresIn: '72h'
        }
      );

      return res.json({
          error: false,
          user: { fullName: user.fullName, email: user.email },
          accessToken,
          message: "Login successful",
      });

  } catch (error) {
      // error handling login
      console.error('Login error details:', error);
      return res.status(500).json({
          error: true,
          message: error.message || "An error occurred during login"
      });
  }
};

const getUser = async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User not found"
      });
    }

    return res.status(200).json({
      error: false,
      user: {
        fullName: user.fullName,
        email: user.email,
        
      },
      message: "User data retrieved successfully",
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      error: true,
      message: "An error occurred while retrieving user data"
    });
  }
};

const postCaption = async (req, res) => {
  try {
    const { title, story, visitedLocation, imageUrl, visitedDate } = req.body;
    const { userId } = req.user;

    // Validate required fields
    if (!title || !story || !visitedLocation || !imageUrl || !visitedDate) {
      return res.status(400).json({ 
        error: true, 
        message: "All fields are required"
      });
    }

    // Create new caption
    const caption = new Caption({
      userId,
      title,
      story,
      visitedLocation,
      imageUrl,
      visitedDate
    });

    // Save to db
    await caption.save();

    return res.status(201).json({
      error: false,
      caption,
      message: "Caption created successfully"
    });

  } catch (error) {
    console.error('Post caption error:', error);
    return res.status(500).json({
      error: true,
      message: "An error occurred while creating caption"
    });
  }
};

//get caption story
const getCaption = async (req, res) => {
  const{ userId } = req.user;

  try{
    const captions = await Caption.find({ userId }).sort({ isFavourite: -1});
    res.status(200).json({stories: captions});
  }catch(error){
    res.status(500).json({error: true, message: error.message});
  }
};

//Image Upload
const uploadImage =async (req, res) => {
  try {
    if(!req.file){
      return res.status(400).json({error: true, message: "No image uploaded"});
    }
    const imageUrl = 'http://localhost:8000/uploads/${req.file.filename}';

    res.status(201).json({ imageUrl });
  }catch (error){
    res.status(500).json({error: true, message: error.message});
  }
};

// Definisi Rute
app.post("/create-account", createAccount);
app.post("/login", login);
app.get("/get-user", authenticateToken, getUser);
app.post("/caption", authenticateToken, postCaption);
app.get("/get-caption", authenticateToken, getCaption);
app.get("/image-upload", upload.single("image"), uploadImage);


// check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: true,
    message: "Internal server error"
  });
});

// Server Port
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
