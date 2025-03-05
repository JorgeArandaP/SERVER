CREATE TABLE users (
  id SERIAL PRIMARY KEY, -- Identificador único del usuario
  name VARCHAR(100) NOT NULL, -- Nombre del usuario
  email VARCHAR(100) UNIQUE NOT NULL, -- Correo electrónico (único)
  password VARCHAR(100) NOT NULL, -- Contraseña (debe estar hasheada)
  phonenumber VARCHAR(20), -- Número de teléfono (opcional)
  address TEXT, -- Dirección (opcional)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Fecha de creación del usuario
);

CREATE TABLE rooms (
  id SERIAL PRIMARY KEY, -- Identificador único de la publicación
  title VARCHAR(100) NOT NULL, -- Título de la publicación
  description TEXT NOT NULL, -- Descripción de la publicación
  price NUMERIC(10, 2) NOT NULL, -- Precio (ejemplo: 100.00)
  address TEXT NOT NULL, -- Dirección de la propiedad
  images TEXT[], -- Lista de URLs de las imágenes (arreglo de texto)
  user_id INT NOT NULL, -- ID del usuario que creó la publicación
  is_completed BOOLEAN DEFAULT FALSE, -- Indica si la publicación está completada (alquilada/vendida)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Fecha de creación de la publicación
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- Relación con la tabla users
);

CREATE TABLE favorites (
  id SERIAL PRIMARY KEY, -- Identificador único del favorito
  user_id INT NOT NULL, -- ID del usuario que agregó la publicación a favoritos
  room_id INT NOT NULL, -- ID de la publicación favorita
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Fecha en que se agregó a favoritos
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, -- Relación con la tabla users
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE, -- Relación con la tabla rooms
  UNIQUE(user_id, room_id) -- Evita duplicados (un usuario no puede agregar la misma publicación dos veces)
);

