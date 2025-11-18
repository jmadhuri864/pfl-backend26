// src/utils/dateTransformer.ts

export const dateTransformer = {
    from: (value: string | Date | null) => {
      if (!value || value === "Invalid Date") return null;
      try {
        const parsedDate = value instanceof Date ? value : new Date(value);
        if (isNaN(parsedDate.getTime())) {
          console.error("Invalid date encountered:", value);
          return null;
        }
        return parsedDate;
      } catch (error) {
        console.error("Date transformation error:", error);
        return null;
      }
    },
    to: (value: Date | null) => (value && value instanceof Date ? value : new Date()),
  };
  