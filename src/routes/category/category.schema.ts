export const CategorySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    culture: { type: "string" },
    parentCategoryId: { type: "string" },
    childCategories: { type: "array", items: { type: "object" } }, // optionally define item structure
    questions: { type: "array", items: { type: "object" } }, // optionally define item structure
  },
};

export const CategoryArraySchema = {
  type: "array",
  items: CategorySchema,
};

export const getAllCategoriesSchema = {
  tags: ["Question"],
  summary: "Get all categories",
  response: {
    200: {
      description: "Categories found",
      $ref: "Category#",
    },
  },
};
export const getCategorySchema = {
  tags: ["Category"],
  summary: "Get category by id",
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  response: {
    200: {
      description: "Category found",
      type: "object",
      $ref: "Category#",
    },
  },
};

export const createCategorySchema = {
  tags: ["Category"],
  summary: "Create Category",
  body: {
    type: "object",
    required: ["name", "description", "parentCategoryId", "culture"],
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      culture: { type: "string" },
      parentCategoryId: { type: "string" },
    },
  },
  response: {
    200: {
      description: "Category created",
      type: "object",
      $ref: "Category#",
    },
  },
};

export const updateCategorySchema = {
  tags: ["Category"],
  summary: "Update Category",
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  body: {
    type: "object",
    required: ["name", "description", "parentCategoryId", "culture"],
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      culture: { type: "string" },
      parentCategoryId: { type: "string" },
    },
  },
  response: {
    200: {
      description: "Category updated",
      type: "object",
      $ref: "Category#",
    },
  },
};

export const deleteCategorySchema = {
  tags: ["Category"],
  summary: "Delete Category",
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  response: {
    200: {
      description: "Category deleted",
      type: "object",
      $ref: "Category#",
    },
  },
};
