CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'target' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `categories_position_idx` ON `categories` (`archived_at`,`position`);
--> statement-breakpoint
INSERT OR IGNORE INTO `categories` (`id`, `name`, `icon`, `position`)
SELECT 'career', 'Career', 'briefcase', 0 WHERE EXISTS (SELECT 1 FROM `tasks` WHERE `category` = 'career') OR EXISTS (SELECT 1 FROM `task_recurrences` WHERE `category` = 'career') OR EXISTS (SELECT 1 FROM `content_milestones` WHERE `category` = 'career');
--> statement-breakpoint
INSERT OR IGNORE INTO `categories` (`id`, `name`, `icon`, `position`)
SELECT 'content', 'Content', 'clapperboard', 1 WHERE EXISTS (SELECT 1 FROM `tasks` WHERE `category` = 'content') OR EXISTS (SELECT 1 FROM `task_recurrences` WHERE `category` = 'content') OR EXISTS (SELECT 1 FROM `content_milestones` WHERE `category` = 'content');
--> statement-breakpoint
INSERT OR IGNORE INTO `categories` (`id`, `name`, `icon`, `position`)
SELECT 'personal', 'Personal', 'coffee', 2 WHERE EXISTS (SELECT 1 FROM `tasks` WHERE `category` = 'other') OR EXISTS (SELECT 1 FROM `task_recurrences` WHERE `category` = 'other');
--> statement-breakpoint
ALTER TABLE `tasks` ADD `category_id` text REFERENCES categories(id);
--> statement-breakpoint
ALTER TABLE `task_recurrences` ADD `category_id` text REFERENCES categories(id);
--> statement-breakpoint
ALTER TABLE `content_milestones` ADD `category_id` text REFERENCES categories(id);
--> statement-breakpoint
UPDATE `tasks` SET `category_id` = CASE `category` WHEN 'career' THEN 'career' WHEN 'content' THEN 'content' ELSE 'personal' END;
--> statement-breakpoint
UPDATE `task_recurrences` SET `category_id` = CASE `category` WHEN 'career' THEN 'career' WHEN 'content' THEN 'content' ELSE 'personal' END;
--> statement-breakpoint
UPDATE `content_milestones` SET `category_id` = CASE `category` WHEN 'career' THEN 'career' ELSE 'content' END;
