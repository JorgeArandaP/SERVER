import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import { consultas } from "./models/consultas.js";
import authMiddleware from "./middleware/authMiddleware.js";
import { pool } from "./database/connection.js";
import upload from "./config/multerConfig.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

cloudinary.config({
  cloud_name: "dsv7xnrgp",
  api_key: "199421492913658",
  api_secret: "WHniwI3wxj0WRq7o-x3UkY0ErhE",
});

app.listen(3000, console.log("Servidor encendido!"));

app.post("/users", async (req, res) => {
  try {
    const user = req.body;
    await consultas.registerUser(user);
    res.send("Usuario creado con exito");
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "An error occurred." });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    await consultas.verificarCredenciales(email, password);
    const userQuery = `
      SELECT id FROM users WHERE email = $1;
    `;
    const { rows } = await pool.query(userQuery, [email]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = rows[0].id;
    const token = jwt.sign({ email, userId }, "az_AZ");
    res.send({ token });
  } catch (error) {
    console.log(error);
    res.status(error.code || 500).send(error);
  }
});

app.get("/users", authMiddleware, async (req, res) => {
  try {
    const { email } = req.user;

    if (!email) {
      return res
        .status(400)
        .send({ error: "El token no contiene un email válido" });
    }

    const info = await consultas.getInfoUsuario(email);
    res.send(info);
  } catch (error) {
    console.error("Error al procesar la solicitud:", error.message);
    res.status(500).send({ error: error.message });
  }
});

app.patch("/users", authMiddleware, async (req, res) => {
  const { name, phonenumber, address } = req.body;
  const userEmail = req.user.email;
  console.log(userEmail);
  try {
    // Consulta SQL para actualizar el usuario
    const query = `
      UPDATE users
      SET 
        name = COALESCE($1, name),
        phoneNumber = COALESCE($2, phonenumber),
        address = COALESCE($3, address)
      WHERE email = $4
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      name,
      phonenumber,
      address,
      userEmail,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/rooms", upload.array("images"), async (req, res) => {
  const { title, description, price, address, userId } = req.body;

  try {
    // Subir imágenes a Cloudinary
    const imageUrls = await Promise.all(
      req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "rooms", // Carpeta en Cloudinary (opcional)
        });
        fs.unlinkSync(file.path); // Eliminar archivo temporal
        return result.secure_url; // URL pública de la imagen
      })
    );

    // Consulta SQL para insertar un nuevo registro en la tabla "rooms"
    const query = `
      INSERT INTO rooms (title, description, price, address, images, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    // Ejecuta la consulta
    const { rows } = await pool.query(query, [
      title,
      description,
      price,
      address,
      imageUrls, // Usamos las URLs de Cloudinary
      userId,
    ]);

    // Devuelve el nuevo listing creado
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/rooms/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const query = `
      SELECT * FROM rooms
      WHERE user_id = $1;
    `;

    const { rows } = await pool.query(query, [userId]);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching user listings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/rooms", async (req, res) => {
  try {
    // Consulta SQL para obtener todas las publicaciones
    const query = `
      SELECT * FROM rooms;
    `;

    // Ejecuta la consulta
    const { rows } = await pool.query(query);

    // Devuelve las publicaciones en formato JSON
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/rooms/:id", async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(" ")[1]; // Obtener el token

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Verificar si el usuario tiene permisos para eliminar la publicación
    const decoded = jwt.verify(token, "az_AZ"); // Reemplaza "az_AZ" con tu clave secreta
    const userId = decoded.userId; // Suponiendo que el token contiene el ID del usuario

    // Verificar si la publicación pertenece al usuario
    const checkQuery = `
      SELECT user_id FROM rooms WHERE id = $1;
    `;
    const { rows } = await pool.query(checkQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (rows[0].user_id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Eliminar la publicación
    const deleteQuery = `
      DELETE FROM rooms WHERE id = $1;
    `;
    await pool.query(deleteQuery, [id]);

    res.status(200).json({ message: "Listing deleted successfully" });
  } catch (error) {
    console.error("Error deleting listing:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch("/rooms/:id/completed", async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(" ")[1]; // Obtener el token

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Decodificar el token para obtener el userId
    const decoded = jwt.verify(token, "az_AZ"); // Reemplaza "az_AZ" con tu clave secreta
    const userId = decoded.userId; // ID del usuario

    // Verificar si la publicación pertenece al usuario
    const checkQuery = `
      SELECT user_id, is_completed FROM rooms WHERE id = $1;
    `;
    const { rows } = await pool.query(checkQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (rows[0].user_id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Alternar el estado de is_completed
    const newCompletedStatus = !rows[0].is_completed;

    // Actualizar la publicación
    const updateQuery = `
      UPDATE rooms
      SET is_completed = $1
      WHERE id = $2
      RETURNING *;
    `;
    const { rows: updatedRows } = await pool.query(updateQuery, [
      newCompletedStatus,
      id,
    ]);

    res.status(200).json(updatedRows[0]);
  } catch (error) {
    console.error("Error toggling listing completion status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/rooms/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT rooms.*, users.name AS user_name, users.email AS user_email, users.phoneNumber AS user_phone
      FROM rooms
      INNER JOIN users ON rooms.user_id = users.id
      WHERE rooms.id = $1;
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching listing:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/favorites", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Obtener el token
  const { roomId } = req.body;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Decodificar el token para obtener el userId
    const decoded = jwt.verify(token, "az_AZ"); // Reemplaza "az_AZ" con tu clave secreta
    const userId = decoded.userId;

    // Verificar si la publicación ya está en favoritos
    const checkQuery = `
      SELECT * FROM favorites WHERE user_id = $1 AND room_id = $2;
    `;
    const { rows } = await pool.query(checkQuery, [userId, roomId]);

    if (rows.length > 0) {
      // Si ya está en favoritos, eliminarlo
      const deleteQuery = `
        DELETE FROM favorites WHERE user_id = $1 AND room_id = $2;
      `;
      await pool.query(deleteQuery, [userId, roomId]);
      res.status(200).json({ message: "Removed from favorites" });
    } else {
      // Si no está en favoritos, agregarlo
      const insertQuery = `
        INSERT INTO favorites (user_id, room_id)
        VALUES ($1, $2);
      `;
      await pool.query(insertQuery, [userId, roomId]);
      res.status(200).json({ message: "Added to favorites" });
    }
  } catch (error) {
    console.error("Error updating favorites:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/favorites/check", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Obtener el token
  const { roomId } = req.query;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Decodificar el token para obtener el userId
    const decoded = jwt.verify(token, "az_AZ"); // Reemplaza "az_AZ" con tu clave secreta
    const userId = decoded.userId;

    // Verificar si la publicación está en favoritos
    const checkQuery = `
      SELECT * FROM favorites WHERE user_id = $1 AND room_id = $2;
    `;
    const { rows } = await pool.query(checkQuery, [userId, roomId]);

    // Devolver si la publicación está en favoritos
    res.status(200).json({ isFavorite: rows.length > 0 });
  } catch (error) {
    console.error("Error checking favorites:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/favorites", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Obtener el token

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Decodificar el token para obtener el userId
    const decoded = jwt.verify(token, "az_AZ"); // Reemplaza "az_AZ" con tu clave secreta
    const userId = decoded.userId;

    // Obtener las publicaciones favoritas del usuario
    const query = `
      SELECT rooms.*
      FROM favorites
      INNER JOIN rooms ON favorites.room_id = rooms.id
      WHERE favorites.user_id = $1;
    `;
    const { rows } = await pool.query(query, [userId]);

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/favorites/:roomId", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Obtener el token
  const { roomId } = req.params;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Decodificar el token para obtener el userId
    const decoded = jwt.verify(token, "az_AZ"); // Reemplaza "az_AZ" con tu clave secreta
    const userId = decoded.userId;

    // Eliminar la publicación de favoritos
    const deleteQuery = `
      DELETE FROM favorites WHERE user_id = $1 AND room_id = $2;
    `;
    await pool.query(deleteQuery, [userId, roomId]);

    res.status(200).json({ message: "Removed from favorites" });
  } catch (error) {
    console.error("Error removing from favorites:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch("/rooms/:id", async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, "az_AZ"); // Reemplaza "az_AZ" con tu clave secreta
    const userId = decoded.userId;

    // Verificar si la publicación pertenece al usuario
    const checkQuery = `
      SELECT user_id FROM rooms WHERE id = $1;
    `;
    const { rows } = await pool.query(checkQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (rows[0].user_id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Actualizar la publicación
    const { title, description, price, address } = req.body;
    const updateQuery = `
      UPDATE rooms
      SET title = $1, description = $2, price = $3, address = $4
      WHERE id = $5
      RETURNING *;
    `;
    const { rows: updatedRows } = await pool.query(updateQuery, [
      title,
      description,
      price,
      address,
      id,
    ]);

    res.status(200).json(updatedRows[0]);
  } catch (error) {
    console.error("Error updating listing:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
