ALTER TABLE `tasks` ADD `anytime_week_start` text;--> statement-breakpoint
CREATE INDEX `tasks_anytime_week_status_idx` ON `tasks` (`anytime_week_start`,`status`);