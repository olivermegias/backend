const mongoose = require("mongoose");

const UsuarioSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // ID de Firebase
  email: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  fechaRegistro: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Usuario", UsuarioSchema);

