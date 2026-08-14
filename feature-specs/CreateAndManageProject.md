# Goal: Create And Manage Project

We need to currently need the ability to create a project. Select a folder, the prepare and process the project.

## Indexing phase

We need to break down the project and its root. This means determining where the root of the project is the file at the root, and slowly parsing each import step by step. Right now we only support TS. We need to handle imports, for both project types and external library types. I do want to avoid parsing external modules exports as this could compound and we should trust the external publisher's abstractions.

At the root we should create a .ruffels folder and a ruffels.config.js

### .ruffels folder

The goal of the ruffels folder is to have a cache and store other metadata to the project that we need to record.

#### Cache

We need to expand on this, but if we do end up parsing and processing the project, we need a indexing system that will store the project complexity into a strucuture we can easily fetch and send to the frontend. This will allow us to quickly serve the application details and graph of the project before we load each section. This also will be a mutable cache(something we need to be careful of) so we can save our processing and mutations.

#### Project metadata

This should be realtivly straight forward, but when opening a project we should store some user specific settings in the config

### ruffels.config.js

This should contain some project configurations. These are top level project configs, such as folders to ignore, removing supported features/setting other details.
