import React, { useState, useEffect } from 'react';
import { LexicalEntry } from '../types';
import { generateQuiz } from '../services/cerebras';

interface Props {
  history: LexicalEntry[];
  onResult: (score: number, total: number) => void;
}

interface Question {
  question: string;
  correctAnswer: string;
  options: string[];
  explanation: string;
}

const Arena: React.FC<Props> = ({ history, onResult }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [revelation, setRevelation] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const loadQuiz = async () => {
      // Base trial only on words the user has actually searched
      if (history.length < 3) {
        setLoading(false);
        return;
      }
      try {
        // Generate up to 20 questions (2 per word for the last 10 entries)
        const data = await generateQuiz(history.slice(0, 10));
        setQuestions(data);
      } catch (err) {
        console.error("Quiz Generation Failed:", err);
      } finally {
        setLoading(false);
      }
    };
    loadQuiz();
  }, [history]);

  const handleOptionSelect = (option: string) => {
    if (revelation) return;
    
    setSelectedOption(option);
    setRevelation(true);
    
    const isCorrect = option === questions[currentIdx].correctAnswer;
    if (isCorrect) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(i => i + 1);
      setSelectedOption(null);
      setRevelation(false);
    } else {
      setFinished(true);
      onResult(score, questions.length);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-16 h-16 border-[4px] border-[#7c1a1a] border-t-transparent rounded-full animate-spin mb-8" />
        <p className="serif text-2xl italic text-stone-300 animate-pulse">Constructing Linguistic Trial...</p>
      </div>
    );
  }

  if (history.length < 3) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 bg-white border border-stone-200 p-12 shadow-xl rounded-sm">
        <h2 className="serif text-5xl font-black mb-6 lowercase text-stone-900">Archive Depth Insufficient</h2>
        <p className="text-stone-400 text-lg mb-10 leading-relaxed font-light serif italic">
          The arena generates trials from your unique search history. Summon at least three inscriptions to proceed.
        </p>
        <div className="bg-[#7c1a1a] h-[1px] w-24 mx-auto" />
      </div>
    );
  }

  if (finished) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 bg-white border border-stone-200/60 p-16 shadow-2xl animate-in zoom-in-95 duration-500 rounded-sm">
        <span className="text-[10px] uppercase tracking-[0.5em] text-[#7c1a1a] font-black block mb-4">Archival Synchronicity Complete</span>
        <h2 className="serif text-6xl font-black mb-8 lowercase text-stone-900">Result Cataloged</h2>
        <p className="text-stone-400 text-xl mb-12 serif italic">Precision: {score} / {questions.length}</p>
        <div className="space-y-6">
          <p className="text-[#7c1a1a] font-black text-5xl tracking-tight">+{score * 5} XP</p>
          <div className="bg-stone-50 py-4 px-10 inline-block border border-stone-100 rounded-sm">
             <span className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-black">Scholarly Progress Recorded</span>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="max-w-[900px] mx-auto py-12">
      <div className="flex justify-between items-end mb-12 border-l-[3px] border-[#7c1a1a] pl-8">
        <div>
          <span className="text-[10px] uppercase tracking-[0.5em] text-stone-400 font-black block mb-1">Active Examination</span>
          <span className="text-stone-900 serif italic text-2xl font-medium">Inscription {currentIdx + 1} of {questions.length}</span>
        </div>
        <div className="w-48 md:w-64 h-[2px] bg-stone-100 relative mb-2">
          <div className="absolute top-0 left-0 h-full bg-[#7c1a1a] transition-all duration-1000" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="bg-white border border-stone-200 p-10 md:p-16 shadow-xl rounded-sm">
        <div className="mb-10 md:mb-14">
          <span className="text-[9px] uppercase tracking-[0.3em] text-stone-400 font-bold block mb-3">Select the corresponding translation</span>
          <h3 className="serif text-4xl md:text-7xl font-bold text-stone-900 leading-tight tracking-tighter lowercase">
            {q.question}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {q.options.map((opt) => {
            const isCorrect = opt === q.correctAnswer;
            const isSelected = opt === selectedOption;
            
            let colorClass = "border-stone-100 hover:border-stone-400 text-stone-800 bg-stone-50/20";
            if (revelation) {
              if (isCorrect) colorClass = "border-green-400 bg-green-50/40 text-green-900 font-bold";
              else if (isSelected) colorClass = "border-red-400 bg-red-50/40 text-red-900";
              else colorClass = "border-stone-50 text-stone-200 opacity-40";
            }

            return (
              <button
                key={opt}
                disabled={revelation}
                onClick={() => handleOptionSelect(opt)}
                className={`w-full text-left p-6 md:p-8 border-2 transition-all duration-500 serif text-xl md:text-3xl rounded-sm lowercase ${colorClass} ${!revelation && 'hover:translate-x-1'}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {revelation && (
          <div className="mt-8 pt-8 border-t border-stone-100 animate-in slide-in-from-top-4 duration-700">
            <span className="text-[10px] uppercase tracking-[0.4em] text-[#7c1a1a] block mb-3 font-black">Archival Note</span>
            <p className="serif italic text-xl md:text-2xl text-stone-600 mb-6 leading-relaxed font-light">{q.explanation}</p>
            <button 
              onClick={nextQuestion}
              className="w-full bg-[#7c1a1a] text-white py-5 md:py-6 text-[11px] font-black tracking-[0.5em] uppercase hover:bg-[#8d2020] transition-all rounded-sm shadow-xl active:scale-[0.98]"
            >
              Continue Manifestation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Arena;