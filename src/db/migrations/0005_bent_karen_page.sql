CREATE TABLE `content_milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`type` text DEFAULT 'custom' NOT NULL,
	`target_value` integer,
	`achieved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_milestones_achieved_at_idx` ON `content_milestones` (`achieved_at`);--> statement-breakpoint
CREATE INDEX `content_milestones_created_at_idx` ON `content_milestones` (`created_at`);--> statement-breakpoint
CREATE INDEX `tasks_category_status_idx` ON `tasks` (`category`,`status`);