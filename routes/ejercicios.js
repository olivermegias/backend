const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const pLimit = require("p-limit").default;
const Ejercicio = require("../models/Ejercicios.js");

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

// Límite de concurrencia para evitar sobrecarga en Cloudinary
const limit = pLimit(5);

// Función para descargar una imagen localmente antes de subirla
const descargarImagen = async (url, filename) => {
  const filePath = path.join(__dirname, filename);
  const writer = fs.createWriteStream(filePath);

  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 10000, // Evita que una imagen bloqueada cuelgue el proceso
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(filePath));
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`⚠️ Error descargando imagen ${url}:`, error.message);
    return null;
  }
};

// Subir imágenes a Cloudinary con control de concurrencia
const subirImagenACloudinary = async (imagenUrl, nombreEjercicio, indice) => {
  try {
    console.log(`📥 Descargando imagen: ${imagenUrl}`);
    const tempPath = await descargarImagen(imagenUrl, `temp_${indice}.jpg`);

    if (!tempPath) {
      console.error(`❌ No se pudo descargar la imagen: ${imagenUrl}`);
      return null;
    }

    console.log(`📤 Subiendo imagen a Cloudinary: ${tempPath}`);

    const result = await cloudinary.uploader.upload(tempPath, {
      folder: `ejercicios/${nombreEjercicio.replace(/[^a-zA-Z0-9_-]/g, "_")}`, // Reemplaza caracteres inválidos
      use_filename: true,
      unique_filename: false, // Permite sobrescribir si ya existe
    });

    // Eliminar el archivo temporal después de subirlo
    await fs.promises.unlink(tempPath);

    return result.secure_url;
  } catch (error) {
    console.error(`❌ Error subiendo imagen a Cloudinary (${imagenUrl}):`, error.message);
    return null;
  }
};

router.get("/importar", async (req, res) => {
  try {
    const url =
      "https://raw.githubusercontent.com/0x10-z/free-exercise-db-es/refs/heads/main/dist/exercises_es.json";

    const response = await axios.get(url);
    const ejercicios = response.data;

    for (const ejercicio of ejercicios) {
      if (!ejercicio.id || !ejercicio.name) {
        console.log("⚠️ Ejercicio sin ID o nombre:", ejercicio);
        continue;
      }

      const ejercicioExistente = await Ejercicio.findOne({ id: ejercicio.id });

      let imagenesCloudinary = [];

      if (ejercicioExistente && ejercicioExistente.imagenes.length > 0) {
        console.log(`🔄 Ejercicio ${ejercicio.id} ya tiene imágenes, saltando subida.`);
        imagenesCloudinary = ejercicioExistente.imagenes;
      } else {
        const promesasImagenes = (ejercicio.images || []).map((imagen, i) =>
          limit(() =>
            subirImagenACloudinary(
              `https://raw.githubusercontent.com/0x10-z/free-exercise-db-es/main/exercises/${imagen}`,
              ejercicio.name,
              i
            )
          )
        );

        imagenesCloudinary = (await Promise.all(promesasImagenes)).filter(Boolean);
      }

      if (imagenesCloudinary.length === 0) {
        console.log(`🚫 Ejercicio ${ejercicio.id} no tiene imágenes. Será ignorado.`);
        if (ejercicioExistente) {
          console.log(`🗑️ Eliminando ejercicio ${ejercicio.id} de la base de datos.`);
          await Ejercicio.deleteOne({ id: ejercicio.id });
        }
        continue; // No guardar si no hay imágenes
      }

      const ejercicioData = {
        id: ejercicio.id,
        nombre: ejercicio.name,
        fuerza: ejercicio.force,
        nivel: ejercicio.level,
        mecanica: ejercicio.mechanic,
        equipo: ejercicio.equipment,
        musculosPrimarios: ejercicio.primaryMuscles,
        musculosSecundarios: ejercicio.secondaryMuscles,
        instrucciones: ejercicio.instructions,
        categoria: ejercicio.category,
        imagenes: imagenesCloudinary,
      };

      if (ejercicioExistente) {
        console.log(`🔄 Actualizando ejercicio con ID ${ejercicioData.id}`);
        await Ejercicio.updateOne({ id: ejercicioData.id }, ejercicioData);
      } else {
        console.log(`✅ Insertando nuevo ejercicio con ID ${ejercicioData.id}`);
        await new Ejercicio(ejercicioData).save();
      }
    }

    res.status(200).json({ message: "Ejercicios importados correctamente." });
  } catch (error) {
    console.error("❌ Error al importar ejercicios:", error);
    res.status(500).json({ error: "Error al importar ejercicios." });
  }
});

router.get("/", async (req, res) => {
  try {
    const ejercicios = await Ejercicio.find();
    res.json(ejercicios);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener ejercicios." });
  }
});


module.exports = router;