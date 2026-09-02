import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'zh-CN');
  CREATE TYPE "public"."enum_gallery_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__gallery_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__gallery_v_published_locale" AS ENUM('en', 'zh-CN');
  CREATE TYPE "public"."enum_events_category" AS ENUM('livestream', 'hackathon', 'community');
  CREATE TYPE "public"."enum_events_location_mode" AS ENUM('online', 'in-person');
  CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_version_category" AS ENUM('livestream', 'hackathon', 'community');
  CREATE TYPE "public"."enum__events_v_version_location_mode" AS ENUM('online', 'in-person');
  CREATE TYPE "public"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_published_locale" AS ENUM('en', 'zh-CN');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'website-preview');
  CREATE TABLE "gallery" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"thumbnail_id" integer,
  	"video_id" integer,
  	"creator_id" integer,
  	"team_id" integer,
  	"tool_id" integer,
  	"href" varchar,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_gallery_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "gallery_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_gallery_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_thumbnail_id" integer,
  	"version_video_id" integer,
  	"version_creator_id" integer,
  	"version_team_id" integer,
  	"version_tool_id" integer,
  	"version_href" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__gallery_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__gallery_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_gallery_v_locales" (
  	"version_title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"category" "enum_events_category",
  	"start_date_time" timestamp(3) with time zone,
  	"end_date_time" timestamp(3) with time zone,
  	"time_zone" varchar,
  	"location_mode" "enum_events_location_mode",
  	"href" varchar,
  	"new_tab" boolean,
  	"live_video_id" varchar,
  	"recording_video_id" varchar,
  	"card_media_file_id" integer,
  	"card_media_poster_id" integer,
  	"is_featured" boolean,
  	"featured_order" numeric,
  	"featured_autoplay_ms" numeric,
  	"featured_show_title" boolean DEFAULT false,
  	"featured_media_file_id" integer,
  	"featured_media_poster_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_events_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "events_locales" (
  	"title" varchar,
  	"description" varchar,
  	"location_name" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_category" "enum__events_v_version_category",
  	"version_start_date_time" timestamp(3) with time zone,
  	"version_end_date_time" timestamp(3) with time zone,
  	"version_time_zone" varchar,
  	"version_location_mode" "enum__events_v_version_location_mode",
  	"version_href" varchar,
  	"version_new_tab" boolean,
  	"version_live_video_id" varchar,
  	"version_recording_video_id" varchar,
  	"version_card_media_file_id" integer,
  	"version_card_media_poster_id" integer,
  	"version_is_featured" boolean,
  	"version_featured_order" numeric,
  	"version_featured_autoplay_ms" numeric,
  	"version_featured_show_title" boolean DEFAULT false,
  	"version_featured_media_file_id" integer,
  	"version_featured_media_poster_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__events_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_events_v_locales" (
  	"version_title" varchar,
  	"version_description" varchar,
  	"version_location_name" varchar,
  	"version_cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"prefix" varchar DEFAULT 'website/cms',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "media_locales" (
  	"alt" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "creators" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "teams" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tools" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'website-preview' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"gallery_id" integer,
  	"events_id" integer,
  	"media_id" integer,
  	"creators_id" integer,
  	"teams_id" integer,
  	"tools_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "gallery" ADD CONSTRAINT "gallery_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery" ADD CONSTRAINT "gallery_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery" ADD CONSTRAINT "gallery_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery" ADD CONSTRAINT "gallery_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery" ADD CONSTRAINT "gallery_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gallery_locales" ADD CONSTRAINT "gallery_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_gallery_v" ADD CONSTRAINT "_gallery_v_parent_id_gallery_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."gallery"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_gallery_v" ADD CONSTRAINT "_gallery_v_version_thumbnail_id_media_id_fk" FOREIGN KEY ("version_thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_gallery_v" ADD CONSTRAINT "_gallery_v_version_video_id_media_id_fk" FOREIGN KEY ("version_video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_gallery_v" ADD CONSTRAINT "_gallery_v_version_creator_id_creators_id_fk" FOREIGN KEY ("version_creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_gallery_v" ADD CONSTRAINT "_gallery_v_version_team_id_teams_id_fk" FOREIGN KEY ("version_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_gallery_v" ADD CONSTRAINT "_gallery_v_version_tool_id_tools_id_fk" FOREIGN KEY ("version_tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_gallery_v_locales" ADD CONSTRAINT "_gallery_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_gallery_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_card_media_file_id_media_id_fk" FOREIGN KEY ("card_media_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_card_media_poster_id_media_id_fk" FOREIGN KEY ("card_media_poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_featured_media_file_id_media_id_fk" FOREIGN KEY ("featured_media_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_featured_media_poster_id_media_id_fk" FOREIGN KEY ("featured_media_poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_locales" ADD CONSTRAINT "events_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_card_media_file_id_media_id_fk" FOREIGN KEY ("version_card_media_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_card_media_poster_id_media_id_fk" FOREIGN KEY ("version_card_media_poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_featured_media_file_id_media_id_fk" FOREIGN KEY ("version_featured_media_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_featured_media_poster_id_media_id_fk" FOREIGN KEY ("version_featured_media_poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v_locales" ADD CONSTRAINT "_events_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gallery_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_creators_fk" FOREIGN KEY ("creators_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_teams_fk" FOREIGN KEY ("teams_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "gallery_slug_idx" ON "gallery" USING btree ("slug");
  CREATE INDEX "gallery_thumbnail_idx" ON "gallery" USING btree ("thumbnail_id");
  CREATE INDEX "gallery_video_idx" ON "gallery" USING btree ("video_id");
  CREATE INDEX "gallery_creator_idx" ON "gallery" USING btree ("creator_id");
  CREATE INDEX "gallery_team_idx" ON "gallery" USING btree ("team_id");
  CREATE INDEX "gallery_tool_idx" ON "gallery" USING btree ("tool_id");
  CREATE INDEX "gallery_updated_at_idx" ON "gallery" USING btree ("updated_at");
  CREATE INDEX "gallery_created_at_idx" ON "gallery" USING btree ("created_at");
  CREATE INDEX "gallery__status_idx" ON "gallery" USING btree ("_status");
  CREATE UNIQUE INDEX "gallery_locales_locale_parent_id_unique" ON "gallery_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_gallery_v_parent_idx" ON "_gallery_v" USING btree ("parent_id");
  CREATE INDEX "_gallery_v_version_version_slug_idx" ON "_gallery_v" USING btree ("version_slug");
  CREATE INDEX "_gallery_v_version_version_thumbnail_idx" ON "_gallery_v" USING btree ("version_thumbnail_id");
  CREATE INDEX "_gallery_v_version_version_video_idx" ON "_gallery_v" USING btree ("version_video_id");
  CREATE INDEX "_gallery_v_version_version_creator_idx" ON "_gallery_v" USING btree ("version_creator_id");
  CREATE INDEX "_gallery_v_version_version_team_idx" ON "_gallery_v" USING btree ("version_team_id");
  CREATE INDEX "_gallery_v_version_version_tool_idx" ON "_gallery_v" USING btree ("version_tool_id");
  CREATE INDEX "_gallery_v_version_version_updated_at_idx" ON "_gallery_v" USING btree ("version_updated_at");
  CREATE INDEX "_gallery_v_version_version_created_at_idx" ON "_gallery_v" USING btree ("version_created_at");
  CREATE INDEX "_gallery_v_version_version__status_idx" ON "_gallery_v" USING btree ("version__status");
  CREATE INDEX "_gallery_v_created_at_idx" ON "_gallery_v" USING btree ("created_at");
  CREATE INDEX "_gallery_v_updated_at_idx" ON "_gallery_v" USING btree ("updated_at");
  CREATE INDEX "_gallery_v_snapshot_idx" ON "_gallery_v" USING btree ("snapshot");
  CREATE INDEX "_gallery_v_published_locale_idx" ON "_gallery_v" USING btree ("published_locale");
  CREATE INDEX "_gallery_v_latest_idx" ON "_gallery_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_gallery_v_locales_locale_parent_id_unique" ON "_gallery_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX "events_card_media_card_media_file_idx" ON "events" USING btree ("card_media_file_id");
  CREATE INDEX "events_card_media_card_media_poster_idx" ON "events" USING btree ("card_media_poster_id");
  CREATE INDEX "events_featured_media_featured_media_file_idx" ON "events" USING btree ("featured_media_file_id");
  CREATE INDEX "events_featured_media_featured_media_poster_idx" ON "events" USING btree ("featured_media_poster_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "events__status_idx" ON "events" USING btree ("_status");
  CREATE UNIQUE INDEX "events_locales_locale_parent_id_unique" ON "events_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_events_v_parent_idx" ON "_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_card_media_version_card_media_file_idx" ON "_events_v" USING btree ("version_card_media_file_id");
  CREATE INDEX "_events_v_version_card_media_version_card_media_poster_idx" ON "_events_v" USING btree ("version_card_media_poster_id");
  CREATE INDEX "_events_v_version_featured_media_version_featured_media__idx" ON "_events_v" USING btree ("version_featured_media_file_id");
  CREATE INDEX "_events_v_version_featured_media_version_featured_medi_1_idx" ON "_events_v" USING btree ("version_featured_media_poster_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_snapshot_idx" ON "_events_v" USING btree ("snapshot");
  CREATE INDEX "_events_v_published_locale_idx" ON "_events_v" USING btree ("published_locale");
  CREATE INDEX "_events_v_latest_idx" ON "_events_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_events_v_locales_locale_parent_id_unique" ON "_events_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "creators_name_idx" ON "creators" USING btree ("name");
  CREATE INDEX "creators_updated_at_idx" ON "creators" USING btree ("updated_at");
  CREATE INDEX "creators_created_at_idx" ON "creators" USING btree ("created_at");
  CREATE UNIQUE INDEX "teams_name_idx" ON "teams" USING btree ("name");
  CREATE INDEX "teams_updated_at_idx" ON "teams" USING btree ("updated_at");
  CREATE INDEX "teams_created_at_idx" ON "teams" USING btree ("created_at");
  CREATE UNIQUE INDEX "tools_name_idx" ON "tools" USING btree ("name");
  CREATE INDEX "tools_updated_at_idx" ON "tools" USING btree ("updated_at");
  CREATE INDEX "tools_created_at_idx" ON "tools" USING btree ("created_at");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_gallery_id_idx" ON "payload_locked_documents_rels" USING btree ("gallery_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_creators_id_idx" ON "payload_locked_documents_rels" USING btree ("creators_id");
  CREATE INDEX "payload_locked_documents_rels_teams_id_idx" ON "payload_locked_documents_rels" USING btree ("teams_id");
  CREATE INDEX "payload_locked_documents_rels_tools_id_idx" ON "payload_locked_documents_rels" USING btree ("tools_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "gallery" CASCADE;
  DROP TABLE "gallery_locales" CASCADE;
  DROP TABLE "_gallery_v" CASCADE;
  DROP TABLE "_gallery_v_locales" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "events_locales" CASCADE;
  DROP TABLE "_events_v" CASCADE;
  DROP TABLE "_events_v_locales" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  DROP TABLE "creators" CASCADE;
  DROP TABLE "teams" CASCADE;
  DROP TABLE "tools" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_gallery_status";
  DROP TYPE "public"."enum__gallery_v_version_status";
  DROP TYPE "public"."enum__gallery_v_published_locale";
  DROP TYPE "public"."enum_events_category";
  DROP TYPE "public"."enum_events_location_mode";
  DROP TYPE "public"."enum_events_status";
  DROP TYPE "public"."enum__events_v_version_category";
  DROP TYPE "public"."enum__events_v_version_location_mode";
  DROP TYPE "public"."enum__events_v_version_status";
  DROP TYPE "public"."enum__events_v_published_locale";
  DROP TYPE "public"."enum_users_role";`)
}
