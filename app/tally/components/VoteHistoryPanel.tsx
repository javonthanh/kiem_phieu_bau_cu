"use client";

import React, { useRef, useState } from "react";
import Draggable from "react-draggable";
import { Pencil, ChevronDown, ChevronUp } from "lucide-react";

export default function VoteHistoryPanel({
  config,
  isEditMode,
  recentVotes,
  editingVoteId,
  updateHistoryPos,
  startEditVote,
  renderFullCandidateList,
}: any) {
  const historyRef = useRef<HTMLDivElement>(null);
  const [isBodyOpen, setIsBodyOpen] = useState(true);

  return (
    <Draggable
      nodeRef={historyRef}
      position={{
        x: config?.historyX ?? 20,
        y: config?.historyY ?? 100,
      }}
      onStop={(e, data) => updateHistoryPos(data.x, data.y)}
    >
      <div
        ref={historyRef}
        className={`absolute w-80 rounded-3xl p-1 border-2 border-blue-500 transition-all duration-300 ${
          isEditMode
            ? "z-[100] ring-2 ring-blue-500/60 ring-dashed p-4 bg-blue-500/5 rounded-3xl cursor-move"
            : `p-0 z-[120]`
        }`}
      >
        <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {/* ================= HEADER ================= */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
              <span className="text-[12px] font-black uppercase tracking-widest text-zinc-300">
                Nhật ký phiếu
              </span>
            </div>

            {/* Toggle body */}
            <button
              onClick={() => setIsBodyOpen((v) => !v)}
              className="text-zinc-500 hover:text-zinc-300 transition"
              title={isBodyOpen ? "Thu gọn" : "Mở ra"}
            >
              {isBodyOpen ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          </div>

          {/* ================= BODY (COLLAPSIBLE) ================= */}
          <div
            className={`relative transition-all duration-300 ease-in-out ${
              isBodyOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
            } overflow-hidden`}
          >
            {/* Fade chỉ hiện khi mở */}
            {isBodyOpen && (
              <>
                <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-zinc-950/80 to-transparent z-10" />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-zinc-950/80 to-transparent z-10" />
              </>
            )}

            <div className="overflow-y-auto p-3 flex flex-col gap-3 scrollbar-pro scroll-smooth max-h-[400px]">
              {recentVotes?.map((vote: any) => {
                const isBeingEdited = editingVoteId === vote.id;

                return (
                  <div
                    key={vote.id}
                    className={`group rounded-xl border p-3 transition-all duration-200 ${
                      isBeingEdited
                        ? "bg-yellow-500/10 border-yellow-500/40"
                        : "bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.09]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-black px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">
                          #{vote.voteNumberInGroup}
                        </div>
                        <span className="text-[9px] font-mono text-zinc-600">
                          {new Date(vote.timestamp).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {!isBeingEdited && (
                        <Pencil
                          size={10}
                          onClick={() => startEditVote(vote)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 cursor-pointer transition"
                        />
                      )}
                    </div>

                    <div className="pl-2 border-l border-white/5">
                      {renderFullCandidateList(vote)}
                    </div>
                  </div>
                );
              })}

              {recentVotes?.length === 0 && (
                <div className="py-10 text-center text-[10px] uppercase tracking-widest text-zinc-600">
                  Chưa có dữ liệu
                </div>
              )}
            </div>
          </div>

          {/* ================= FOOTER ================= */}
          <div className="border-t border-white/5 bg-white/[0.02] py-1.5 text-center" />
        </div>
      </div>
    </Draggable>
  );
}
