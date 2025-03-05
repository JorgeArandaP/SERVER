import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  const Authorization = req.header("Authorization");

  if (!Authorization || !Authorization.startsWith("Bearer ")) {
    return res
      .status(401)
      .send({ error: "Token no proporcionado o mal formado" });
  }

  const token = Authorization.split("Bearer ")[1];

  try {
    const decoded = jwt.verify(token, "az_AZ");
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Error al verificar el token:", error.message);
    res.status(401).send({ error: "Token inválido o expirado" });
  }
};

export default authMiddleware;
