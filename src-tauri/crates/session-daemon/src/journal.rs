use openforge_session_protocol::*;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard};

const MAX_EVENT_BYTES: usize = 512 * 1024;
const MAX_EVENTS: usize = 4096;

#[derive(Default)]
pub struct Journal {
    pub cursor: u64,
    events: VecDeque<(u64, Event, usize)>,
    retained_bytes: usize,
}

pub type SharedJournal = Arc<Mutex<Journal>>;
pub fn lock(journal: &SharedJournal) -> MutexGuard<'_, Journal> {
    journal
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl Journal {
    pub fn publish(&mut self, event: Event) {
        let size = match &event {
            Event::Output { data, .. } => data.len() + 512,
            _ => 512,
        };
        // On exhaustion the process must not wrap an event cursor and reuse old identities.
        let Some(cursor) = self.cursor.checked_add(1) else {
            return;
        };
        self.cursor = cursor;
        self.retained_bytes += size;
        self.events.push_back((cursor, event, size));
        while self.retained_bytes > MAX_EVENT_BYTES || self.events.len() > MAX_EVENTS {
            if let Some((_, _, size)) = self.events.pop_front() {
                self.retained_bytes -= size;
            }
        }
    }

    pub fn events(&self, after: u64) -> Result<EventBatch, Error> {
        if after > self.cursor {
            return Err(Error::InvalidRequest);
        }
        let first = self
            .events
            .front()
            .map_or(self.cursor.saturating_add(1), |(cursor, _, _)| *cursor);
        Ok(EventBatch {
            cursor: self.cursor,
            gap: after.saturating_add(1) < first,
            retained_bytes: self.retained_bytes,
            events: self
                .events
                .iter()
                .filter(|(cursor, _, _)| *cursor > after)
                .map(|(_, event, _)| event.clone())
                .collect(),
        })
    }
}
