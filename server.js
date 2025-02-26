const express = require("express");
const connectDB = require("./database.js");
const ejerciciosRoutes = require("./routes/ejercicios.js");
const usuariosRoutes = require("./routes/usuarios.js");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

connectDB();

app.use(cors());
app.use(express.json());

app.use("/ejercicios", ejerciciosRoutes);
app.use("/usuarios", usuariosRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
