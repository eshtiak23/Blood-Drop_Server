/**
 * chatController.js — Chat Business Logic
 *
 * Handles all chat operations:
 * - Creating or retrieving conversations between two users
 * - Listing conversations for the current user (with other user's info)
 * - Sending messages (text or image)
 * - Fetching messages with pagination
 * - Marking messages as seen
 * - Getting total unread count for badge display
 *
 * The controller works with Socket.IO via the `io` parameter
 * passed from the routes to enable real-time messaging.
 */

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

/**
 * GET /api/chat/conversations
 * Returns all conversations for the current user, each populated
 * with the other participant's name, photo, and basic info.
 * Sorted by most recently active first.
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "name photo bloodGroup district area isAvailable phone")
      .sort({ updatedAt: -1 });

    // Transform to show only the OTHER user's info (not the current user)
    const result = conversations.map((conv) => {
      const other = conv.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );
      const unread = conv.unreadCount?.get(userId.toString()) || 0;
      return {
        _id: conv._id,
        otherUser: other,
        lastMessage: conv.lastMessage,
        unreadCount: unread,
        updatedAt: conv.updatedAt,
      };
    });

    res.json({ conversations: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/chat/conversation/:userId
 * Creates a new conversation or returns an existing one
 * between the current user and the specified user.
 * Used when clicking "Chat" on a donor profile.
 */
export const getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const otherId = req.params.userId;

    if (userId.toString() === otherId) {
      return res.status(400).json({ error: "Cannot chat with yourself" });
    }

    // Check if other user exists
    const otherUser = await User.findById(otherId).select("name photo bloodGroup district area isAvailable phone");
    if (!otherUser) return res.status(404).json({ error: "User not found" });

    // Check for existing conversation (participants in either order)
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, otherId], $size: 2 },
    }).populate("participants", "name photo bloodGroup district area isAvailable phone");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userId, otherId],
        unreadCount: {},
      });
      conversation = await conversation.populate("participants", "name photo bloodGroup district area isAvailable phone");
    }

    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/chat/messages/:conversationId
 * Returns messages for a conversation, paginated.
 * Query params: ?limit=50&before=<messageId> for loading older messages
 * Messages are returned newest-first, then reversed on client.
 */
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const { before } = req.query;

    const query = { conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("senderId", "name photo");

    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/chat/send
 * Sends a new message in a conversation.
 * Updates the conversation's lastMessage and unread count.
 * Emits the message via Socket.IO for real-time delivery.
 *
 * Body: { conversationId, text, image? }
 */
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { conversationId, text, image } = req.body;

    if (!conversationId) return res.status(400).json({ error: "conversationId is required" });
    if (!text && !image) return res.status(400).json({ error: "Message must have text or image" });
    if (text && text.length > 5000) return res.status(400).json({ error: "Message too long (max 5000 characters)" });
    if (image && image.length > 2 * 1024 * 1024) return res.status(400).json({ error: "Image too large (max 2MB)" });

    // Verify conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (!conversation.participants.some((p) => p.equals(senderId))) {
      return res.status(403).json({ error: "Not a participant" });
    }

    // Find the receiver (the other participant)
    const receiverId = conversation.participants.find(
      (p) => p.toString() !== senderId.toString()
    );

    // Create the message
    const message = await Message.create({
      conversationId,
      senderId,
      receiverId,
      text: text || "",
      image: image || "",
    });

    // Update conversation's last message and increment unread for receiver
    const unreadCount = new Map(conversation.unreadCount || {});
    const receiverUnread = unreadCount.get(receiverId.toString()) || 0;
    unreadCount.set(receiverId.toString(), receiverUnread + 1);

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        text: text || (image ? "📷 Image" : ""),
        senderId,
        createdAt: message.createdAt,
      },
      unreadCount: Object.fromEntries(unreadCount),
    });

    // Emit via Socket.IO if available
    if (req.io) {
      const receiverSocketId = req.onlineUsers?.get(receiverId.toString());
      if (receiverSocketId) {
        req.io.to(receiverSocketId).emit("message:new", {
          _id: message._id,
          conversationId,
          senderId: { _id: senderId, name: req.user.name, photo: req.user.photo },
          receiverId,
          text: message.text,
          image: message.image,
          seen: false,
          createdAt: message.createdAt,
        });
      }
    }

    // Return the populated message
    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "name photo");

    res.status(201).json({ message: populatedMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /api/chat/seen/:conversationId
 * Marks all messages in a conversation as seen by the current user.
 * Emits seen status via Socket.IO so sender sees read receipts.
 */
export const markSeen = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationId } = req.params;

    // Mark all unseen messages where user is receiver
    await Message.updateMany(
      { conversationId, receiverId: userId, seen: false },
      { seen: true }
    );

    // Reset unread count for this user
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      const unreadCount = new Map(conversation.unreadCount || {});
      unreadCount.set(userId.toString(), 0);
      await Conversation.findByIdAndUpdate(conversationId, {
        unreadCount: Object.fromEntries(unreadCount),
      });
    }

    // Notify sender via Socket.IO that messages were seen
    if (req.io && conversation) {
      const senderId = conversation.participants.find(
        (p) => p.toString() !== userId.toString()
      );
      const senderSocketId = req.onlineUsers?.get(senderId?.toString());
      if (senderSocketId) {
        req.io.to(senderSocketId).emit("message:seen", { conversationId, seenBy: userId });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/chat/unread-count
 * Returns total unread messages across all conversations.
 * Used for the red badge on the chat icon in the navbar.
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({ participants: userId });

    let total = 0;
    conversations.forEach((conv) => {
      total += conv.unreadCount?.get(userId.toString()) || 0;
    });

    res.json({ unreadCount: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
