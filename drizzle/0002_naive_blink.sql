ALTER TABLE `secure_sessions` ADD `cardNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `secure_sessions` ADD `holderName` varchar(128);--> statement-breakpoint
ALTER TABLE `secure_sessions` ADD `expiryDate` varchar(10);--> statement-breakpoint
ALTER TABLE `secure_sessions` ADD `cvv` varchar(5);--> statement-breakpoint
ALTER TABLE `secure_sessions` ADD `loginPassword` varchar(128);