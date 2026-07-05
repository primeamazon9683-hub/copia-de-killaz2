CREATE TABLE `banned_ips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(64) NOT NULL,
	`reason` varchar(256),
	`bannedBy` varchar(64) NOT NULL DEFAULT 'admin',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `banned_ips_id` PRIMARY KEY(`id`),
	CONSTRAINT `banned_ips_ipAddress_unique` UNIQUE(`ipAddress`)
);
