export type ReviewStatus = "pending" | "approved" | "rejected" | "published";

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  relevance: number | null;
  topic: string | null;
  tags: string[] | null;
  review_status: ReviewStatus | null;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  author: string | null;
  body: string | null;
}

export interface Database {
  public: {
    Tables: {
      news_items: {
        Row: NewsItem;
        Insert: Partial<NewsItem> & { title: string; source_url: string };
        Update: Partial<NewsItem>;
      };
    };
  };
}
