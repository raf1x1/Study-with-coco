export interface Card {
  id: string;
  front: string;
  back: string;
  quizOptions?: string[];
  quizCorrect?: number;
  quizExplanation?: string;
}

export interface Deck {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cards: Card[];
  studied: number;
  correct: number;
  lastStudied: number | null;
  fromFile?: string;
  coverImage?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface Activity {
  text: string;
  time: number;
}

export interface AppState {
  decks: Deck[];
  activity: Activity[];
  stats: {
    totalStudied: number;
    totalCorrect: number;
    streak: number;
    lastStudyDate: string | null;
  };
}
