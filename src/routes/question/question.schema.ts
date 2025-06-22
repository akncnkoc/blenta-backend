export const getCategoryQuestionsSchema = {
  tags: ["Question"],
  summary: "Get category questions",
  params: {
    type: "object",
    required: ["categoryId"],
    properties: {
      categoryId: { type: "string", format: "uuid" },
    },
  },
  response: {
    200: {
      description: "Questions found",
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          categoryId: { type: "string" },
          culture: { type: "string" },
          sort: { type: "number" },
        },
      },
    },
  },
};
export const getQuestionSchema = {
  tags: ["Question"],
  summary: "Get question by id",
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  response: {
    200: {
      description: "Question found",
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        categoryId: { type: "string" },
        culture: { type: "string" },
        sort: { type: "number" },
      },
    },
  },
};

export const createQuestionSchema = {
  tags: ["Question"],
  summary: "Create Question",
  body: {
    type: "object",
    required: ["title", "description", "categoryId", "culture", "sort"],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      categoryId: { type: "string" },
      culture: { type: "string" },
      sort: { type: "integer" }, // ✔ correct type for number
    },
  },
  response: {
    200: {
      description: "Question created",
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        categoryId: { type: "string" },
        culture: { type: "string" },
        sort: { type: "integer" }, // ✔ match the input type
      },
    },
  },
};

export const updateQuestionSchema = {
  tags: ["Question"],
  summary: "Update Question",
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  body: {
    type: "object",
    required: ["title", "description", "categoryId", "culture", "sort"],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      categoryId: { type: "string" },
      culture: { type: "string" },
      sort: { type: "integer" }, // ✔ correct type for number
    },
  },
  response: {
    200: {
      description: "Question updated",
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        categoryId: { type: "string" },
        culture: { type: "string" },
        sort: { type: "integer" }, // ✔ match the input type
      },
    },
  },
};

export const deleteQuestionSchema = {
  tags: ["Question"],
  summary: "Delete Question",
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  response: {
    200: {
      description: "Question deleted",
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        categoryId: { type: "string" },
        culture: { type: "string" },
        sort: { type: "number" },
      },
    },
  },
};
