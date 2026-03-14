"""Tests for DynamoDB chat message service functions."""

from unittest.mock import MagicMock, patch

from app.services.dynamodb import delete_chat_messages, get_chat_history, save_chat_message


def _make_mock_table() -> MagicMock:
    """Create a mock DynamoDB table with default behaviors."""
    table = MagicMock()
    table.put_item.return_value = {}
    table.query.return_value = {"Items": [], "Count": 0}
    batch_writer = MagicMock()
    batch_writer.__enter__ = MagicMock(return_value=batch_writer)
    batch_writer.__exit__ = MagicMock(return_value=False)
    table.batch_writer.return_value = batch_writer
    return table


def test_save_message() -> None:
    """save_chat_message returns item with all fields."""
    table = _make_mock_table()
    with patch("app.services.dynamodb._get_dynamodb_table", return_value=table):
        item = save_chat_message(
            contract_id="contract-123",
            user_id="user-456",
            role="user",
            content="What is the termination clause?",
        )

    assert item["contract_id"] == "contract-123"
    assert item["user_id"] == "user-456"
    assert item["role"] == "user"
    assert item["content"] == "What is the termination clause?"
    assert "message_id" in item
    assert "created_at" in item
    assert item["source_chunks"] == []
    table.put_item.assert_called_once()


def test_save_message_with_sources() -> None:
    """save_chat_message stores source_chunks when provided."""
    table = _make_mock_table()
    sources = [{"page": 3, "text": "30 days notice", "score": 0.92}]
    with patch("app.services.dynamodb._get_dynamodb_table", return_value=table):
        item = save_chat_message(
            contract_id="contract-123",
            user_id="user-456",
            role="assistant",
            content="The termination clause requires 30 days notice.",
            source_chunks=sources,
        )

    # Floats are converted to Decimal for DynamoDB compatibility
    from decimal import Decimal
    expected = [{"page": 3, "text": "30 days notice", "score": Decimal("0.92")}]
    assert item["source_chunks"] == expected


def test_get_history_empty() -> None:
    """get_chat_history for nonexistent contract returns empty list."""
    table = _make_mock_table()
    with patch("app.services.dynamodb._get_dynamodb_table", return_value=table):
        messages = get_chat_history("nonexistent-contract")

    assert messages == []
    table.query.assert_called_once()


def test_get_history_returns_messages() -> None:
    """After saving, messages are returned."""
    table = _make_mock_table()
    table.query.return_value = {
        "Items": [
            {"contract_id": "c1", "created_at": "2026-01-01T00:00:00", "role": "user", "content": "Hello"},
            {"contract_id": "c1", "created_at": "2026-01-01T00:00:01", "role": "assistant", "content": "Hi there"},
        ],
        "Count": 2,
    }
    with patch("app.services.dynamodb._get_dynamodb_table", return_value=table):
        messages = get_chat_history("c1")

    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"


def test_get_history_chronological_order() -> None:
    """Messages returned with ScanIndexForward=True (ascending order)."""
    table = _make_mock_table()
    table.query.return_value = {
        "Items": [
            {"contract_id": "c1", "created_at": "2026-01-01T00:00:00", "content": "First"},
            {"contract_id": "c1", "created_at": "2026-01-01T00:01:00", "content": "Second"},
            {"contract_id": "c1", "created_at": "2026-01-01T00:02:00", "content": "Third"},
        ],
        "Count": 3,
    }
    with patch("app.services.dynamodb._get_dynamodb_table", return_value=table):
        messages = get_chat_history("c1")

    # Verify ScanIndexForward=True was passed (ascending order)
    call_kwargs = table.query.call_args.kwargs
    assert call_kwargs["ScanIndexForward"] is True
    assert len(messages) == 3
    assert messages[0]["content"] == "First"
    assert messages[2]["content"] == "Third"


def test_delete_messages() -> None:
    """delete_chat_messages removes all messages for a contract."""
    table = _make_mock_table()
    table.query.return_value = {
        "Items": [
            {"contract_id": "c1", "created_at": "2026-01-01T00:00:00"},
            {"contract_id": "c1", "created_at": "2026-01-01T00:00:01"},
        ],
        "Count": 2,
    }
    with patch("app.services.dynamodb._get_dynamodb_table", return_value=table):
        deleted = delete_chat_messages("c1")

    assert deleted == 2
    table.batch_writer.assert_called_once()


def test_delete_messages_nonexistent() -> None:
    """Deleting from nonexistent contract returns 0 and doesn't error."""
    table = _make_mock_table()
    table.query.return_value = {"Items": [], "Count": 0}
    with patch("app.services.dynamodb._get_dynamodb_table", return_value=table):
        deleted = delete_chat_messages("nonexistent")

    assert deleted == 0
    table.batch_writer.assert_not_called()
