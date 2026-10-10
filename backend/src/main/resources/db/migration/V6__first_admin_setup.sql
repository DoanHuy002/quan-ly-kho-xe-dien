CREATE TABLE app_setup_state(id INTEGER PRIMARY KEY CHECK(id=1), completed BOOLEAN NOT NULL);
INSERT INTO app_setup_state(id,completed) SELECT 1,EXISTS(SELECT 1 FROM app_users);
