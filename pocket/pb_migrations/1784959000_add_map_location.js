/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("queues");

  if (!collection.fields.getByName("mapLocation")) {
    collection.fields.add(
      new TextField({ name: "mapLocation", required: false, max: 500 }),
    );
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("queues");

  if (collection.fields.getByName("mapLocation")) {
    collection.fields.removeByName("mapLocation");
  }

  return app.save(collection);
});
