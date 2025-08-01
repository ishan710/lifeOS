export interface Reminder {
    notes: string,
    dueDate: Date,
    reminderId: string
}

export interface Thought {
    thought: string
    thoughtId: string
    clusterId: string
}

export interface Cluster {
    clusterID: string
    clusterTitle?: string
}

export interface Notes {
    notes: string
    noteId: string
}