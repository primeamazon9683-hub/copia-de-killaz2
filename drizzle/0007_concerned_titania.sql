CREATE TABLE `traffic_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(64) NOT NULL,
	`userAgent` text,
	`path` varchar(512) DEFAULT '/',
	`country` varchar(64),
	`blocked` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `traffic_log_id` PRIMARY KEY(`id`)
);
