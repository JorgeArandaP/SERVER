import { pool } from "../database/connection.js";
import bcrypt from "bcryptjs";

const registerUser = async (user) => {
  let {
    name,
    email,
    address,
    phoneNumber,
    password,
    confirmPassword,
    acceptTerms,
  } = user;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match." });
  }
  if (!acceptTerms) {
    return res
      .status(400)
      .json({ message: "You must accept the terms and conditions." });
  }
  const passwordEncriptada = bcrypt.hashSync(password);

  const values = [name, email, address, phoneNumber, passwordEncriptada];
  const consulta = "INSERT INTO users values (DEFAULT, $1, $2, $3, $4, $5)";
  await pool.query(consulta, values);
};

const verificarCredenciales = async (email, password) => {
  const values = [email];
  const consulta = "SELECT * FROM users WHERE email = $1";
  const {
    rows: [user],
    rowCount,
  } = await pool.query(consulta, values);

  const { password: passwordEncriptada } = user;
  const passwordEsCorrecta = bcrypt.compareSync(password, passwordEncriptada);

  if (!passwordEsCorrecta || !rowCount) {
    throw { code: 401, message: "Email o contraseña incorrecta" };
  }
};

const getInfoUsuario = async (email) => {
  const values = [email];
  const consulta = "SELECT * FROM users WHERE email=$1";
  const { rows: user } = await pool.query(consulta, values);
  return user;
};

export const consultas = {
  registerUser,
  verificarCredenciales,
  getInfoUsuario,
};
