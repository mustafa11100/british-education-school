const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("SCHOOL PORTAL ONLINE");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "School portal is running"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER STARTED ON PORT " + PORT);
});
