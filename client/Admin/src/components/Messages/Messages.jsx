// client/Admin/src/pages/Messages.jsx
import React, { useState, useRef, useEffect } from "react";
import SearchFil from "../SearchFil/SearchFil";
import styles from "./Messages.module.css";

const sampleConversations = [
	{
		id: 1,
		name: "Jerome Bell",
		messages: [
			{ from: "me", text: "Hi Jerome!", time: "10:00 AM" },
			{
				from: "Jerome Bell",
				text: "Hello! How can I help?",
				time: "10:01 AM",
			},
		],
	},
	{
		id: 2,
		name: "Tom John",
		messages: [
			{ from: "me", text: "Good morning Tom!", time: "09:30 AM" },
			{ from: "Tom John", text: "Good morning!", time: "09:31 AM" },
		],
	},
];

export default function Messages() {
	const [conversations] = useState(sampleConversations);
	const [activeId, setActiveId] = useState(conversations[0].id);
	const [input, setInput] = useState("");
	const messagesEndRef = useRef(null);

	const activeConversation = conversations.find((c) => c.id === activeId);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [activeId, activeConversation.messages.length]);

	const handleSend = (e) => {
		e.preventDefault();
		if (!input.trim()) return;
		activeConversation.messages.push({
			from: "me",
			text: input,
			time: new Date().toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			}),
		});
		setInput("");
		setTimeout(() => {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}, 100);
	};

    return (
        <>
            <div className={styles["messages-header"]}>
                <h1 className={styles["messages-header__title"]}>
                    MESSAGES
                </h1>
                <SearchFil onSearch={(value) => console.log("Search:", value)} />
            </div>

            <div className={styles["messenger-container"]}>
                <aside className={styles["messenger-sidebar"]}>
                    <h2 className={styles["messenger-title"]}>Chats</h2>
                    <ul className={styles["messenger-list"]}>
                        {conversations.map((conv) => (
                            <li
                                key={conv.id}
                                className={`${styles["messenger-list-item"]} ${
                                    activeId === conv.id ? styles["active"] : ""
                                }`}
                                onClick={() => setActiveId(conv.id)}
                            >
                                {conv.name}
                            </li>
                        ))}
                    </ul>
                </aside>
                <main className={styles["messenger-main"]}>
                    <div className={styles["messenger-header"]}>
                        <span className={styles["messenger-chat-name"]}>
                            {activeConversation.name}
                        </span>
                    </div>
                    <div className={styles["messenger-messages"]}>
                        {activeConversation.messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={
                                    msg.from === "me"
                                        ? styles["messenger-message-me"]
                                        : styles["messenger-message-other"]
                                }
                            >
                                <div
                                    className={
                                        msg.from === "me"
                                            ? styles["messenger-message-text-me"]
                                            : styles["messenger-message-text-other"]
                                    }
                                >
                                    {msg.text}
                                </div>
                                {msg.from === "me" ? (
                                    <div className={styles["messenger-message-time-me"]}>
                                        {msg.time}
                                    </div>
                                ) : (
                                    <div className={styles["messenger-message-time-other"]}>
                                        {msg.time}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <form
                        className={styles["messenger-input-row"]}
                        onSubmit={handleSend}
                    >
                        <input
                            type="text"
                            className={styles["messenger-input"]}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a message..."
                        />
                        <button
                            className={styles["messenger-send-btn"]}
                            type="submit"
                        >
                            Send
                        </button>
                    </form>
                </main>
            </div>
        </>
    );
}
