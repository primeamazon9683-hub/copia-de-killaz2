CREATE TABLE `visit_counter` (
	`id` int AUTO_INCREMENT NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visit_counter_id` PRIMARY KEY(`id`)
);
