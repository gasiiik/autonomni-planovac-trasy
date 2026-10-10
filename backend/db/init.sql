CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8)
);

CREATE TABLE IF NOT EXISTS activity_pois (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- RUNNING, WALKING, GASTRO, FESTIVAL, EVENT, SIGHTSEEING
    est_duration_mins INT,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    image_url TEXT,
    open_time VARCHAR(5) DEFAULT '09:00',
    close_time VARCHAR(5) DEFAULT '18:00',
    price_estimated FLOAT DEFAULT 0.0,
    tags VARCHAR(255) DEFAULT '',
    family_friendly TINYINT(1) DEFAULT 1,
    difficulty_level VARCHAR(20) DEFAULT 'EASY',
    source VARCHAR(30) DEFAULT 'MANUAL',      -- MANUAL / DATAZAPAD
    external_id VARCHAR(150),                 -- ID záznamu v DataZápad (služba:OBJECTID)
    website VARCHAR(255),
    indoor TINYINT(1) DEFAULT 0,              -- 1 = vnitřní aktivita (vhodná při dešti)
    address VARCHAR(255),
    season_from TINYINT,                      -- měsíc 1-12, od kdy má místo sezónu (NULL = celoročně)
    season_to TINYINT,                        -- měsíc 1-12, do kdy
    INDEX idx_external_id (external_id),
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS datasets (
    service VARCHAR(150) PRIMARY KEY,         -- název ArcGIS služby = prefix activity_pois.external_id
    title VARCHAR(255),
    item_id VARCHAR(64),
    url VARCHAR(255),                         -- stránka datové sady na datazapad.cz
    license VARCHAR(50),
    records_total INT,                        -- záznamů v datové sadě
    places_used INT,                          -- míst, která po zpracování používá plánovač
    imported_at DATETIME
);

INSERT INTO users (username, password_hash) VALUES ('admin', '$2y$10$w6z/6G2gQdYtU3r5S0E.e.DqzqRXXrM6Y4O1/8G9E9X4E0fT8H3g6');

-- Karlovarský kraj: Pár měst jako ukázka (s výchozím bodem v centru)
INSERT INTO locations (name, lat, lng) VALUES ('Karlovy Vary', 50.2327, 12.8712);
INSERT INTO locations (name, lat, lng) VALUES ('Cheb', 50.0797, 12.3739);
INSERT INTO locations (name, lat, lng) VALUES ('Františkovy Lázně', 50.1197, 12.3512);

-- Karlovy Vary POIs
INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) 
VALUES (1, 'Vřídelní kolonáda', 'Hlavní centrum pro památky a ochutnávky.', 'SIGHTSEEING', 45, 50.2230, 12.8833, NULL);

INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) 
VALUES (1, 'Grandhotel Pupp', 'Skvělé místo na kávu a zákusek po cestě.', 'GASTRO', 40, 50.2192, 12.8808, NULL);

INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) 
VALUES (1, 'Běh podél Teplé', 'Trasa pro aktivní běžce s výhledem.', 'RUNNING', 30, 50.2150, 12.8780, NULL);

-- Cheb POIs
INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) 
VALUES (2, 'Chebský hrad', 'Prohlídka historického hradu.', 'SIGHTSEEING', 90, 50.0815, 12.3664, NULL);

INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) 
VALUES (2, 'Chebské farmářské trhy', 'Festival plný lokálních potravin.', 'FESTIVAL', 60, 50.0795, 12.3701, NULL);
INSERT INTO locations (name, lat, lng) VALUES ('Abertamy', 50.368, 12.818);
INSERT INTO locations (name, lat, lng) VALUES ('Bečov nad Teplou', 50.084, 12.839);
INSERT INTO locations (name, lat, lng) VALUES ('Bochov', 50.149, 13.048);
INSERT INTO locations (name, lat, lng) VALUES ('Boží Dar', 50.41, 12.923);
INSERT INTO locations (name, lat, lng) VALUES ('Horní Blatná', 50.39, 12.771);
INSERT INTO locations (name, lat, lng) VALUES ('Hroznětín', 50.309, 12.873);
INSERT INTO locations (name, lat, lng) VALUES ('Chyše', 50.106, 13.254);
INSERT INTO locations (name, lat, lng) VALUES ('Jáchymov', 50.361, 12.929);
INSERT INTO locations (name, lat, lng) VALUES ('Nejdek', 50.324, 12.733);
INSERT INTO locations (name, lat, lng) VALUES ('Nová Role', 50.27, 12.78);
INSERT INTO locations (name, lat, lng) VALUES ('Ostrov', 50.305, 12.939);
INSERT INTO locations (name, lat, lng) VALUES ('Toužim', 50.06, 12.984);
INSERT INTO locations (name, lat, lng) VALUES ('Žlutice', 50.091, 13.161);
INSERT INTO locations (name, lat, lng) VALUES ('Sokolov', 50.181, 12.639);
INSERT INTO locations (name, lat, lng) VALUES ('Březová', 50.145, 12.646);
INSERT INTO locations (name, lat, lng) VALUES ('Habartov', 50.185, 12.533);
INSERT INTO locations (name, lat, lng) VALUES ('Horní Slavkov', 50.138, 12.805);
INSERT INTO locations (name, lat, lng) VALUES ('Chodov', 50.241, 12.748);
INSERT INTO locations (name, lat, lng) VALUES ('Kraslice', 50.327, 12.502);
INSERT INTO locations (name, lat, lng) VALUES ('Kynšperk nad Ohří', 50.119, 12.532);
INSERT INTO locations (name, lat, lng) VALUES ('Loket', 50.187, 12.753);
INSERT INTO locations (name, lat, lng) VALUES ('Nové Sedlo', 50.207, 12.735);
INSERT INTO locations (name, lat, lng) VALUES ('Oloví', 50.258, 12.556);
INSERT INTO locations (name, lat, lng) VALUES ('Přebuz', 50.37, 12.617);
INSERT INTO locations (name, lat, lng) VALUES ('Rotava', 50.3, 12.574);
INSERT INTO locations (name, lat, lng) VALUES ('Aš', 50.224, 12.186);
INSERT INTO locations (name, lat, lng) VALUES ('Hranice', 50.305, 12.176);
INSERT INTO locations (name, lat, lng) VALUES ('Lázně Kynžvart', 50.01, 12.625);
INSERT INTO locations (name, lat, lng) VALUES ('Luby', 50.252, 12.404);
INSERT INTO locations (name, lat, lng) VALUES ('Mariánské Lázně', 49.973, 12.702);
INSERT INTO locations (name, lat, lng) VALUES ('Plesná', 50.222, 12.35);
INSERT INTO locations (name, lat, lng) VALUES ('Skalná', 50.17, 12.36);
INSERT INTO locations (name, lat, lng) VALUES ('Teplá', 49.977, 12.863);
INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) VALUES ((SELECT id FROM locations WHERE name = 'Mariánské Lázně' LIMIT 1), 'Zpívající fontána', 'Unikátní fontána hrající světoznámé skladby.', 'SIGHTSEEING', 30, 49.9765, 12.7068, NULL);
INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) VALUES ((SELECT id FROM locations WHERE name = 'Mariánské Lázně' LIMIT 1), 'Kolonáda Maxima Gorkého', 'Hlavní lázeňská kolonáda s prameny.', 'SIGHTSEEING', 60, 49.9772, 12.7075, NULL);
INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) VALUES ((SELECT id FROM locations WHERE name = 'Mariánské Lázně' LIMIT 1), 'Park Boheminium', 'Miniatury významných českých památek.', 'PARK', 120, 49.972, 12.718, NULL);
INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) VALUES ((SELECT id FROM locations WHERE name = 'Loket' LIMIT 1), 'Hrad Loket', 'Gotický královský hrad tyčící se nad řekou Ohří.', 'SIGHTSEEING', 120, 50.1873, 12.754, NULL);
INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) VALUES ((SELECT id FROM locations WHERE name = 'Karlovy Vary' LIMIT 1), 'Mlýnská kolonáda', 'Největší z karlovarských kolonád se 124 sloupy.', 'SIGHTSEEING', 45, 50.2255, 12.8805, NULL);
INSERT INTO activity_pois (location_id, name, description, category, est_duration_mins, lat, lng, image_url) VALUES ((SELECT id FROM locations WHERE name = 'Františkovy Lázně' LIMIT 1), 'Socha Františka', 'Symbol Františkových Lázní pro štěstí.', 'SIGHTSEEING', 20, 50.1202, 12.351, NULL);
