CREATE TABLE `task_recurrences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`estimated_minutes` integer,
	`count_per_week` integer NOT NULL,
	`start_week` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence_id` integer REFERENCES task_recurrences(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence_week_start` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence_index` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_recurrence_instance_idx` ON `tasks` (`recurrence_id`,`recurrence_week_start`,`recurrence_index`);