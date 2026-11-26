import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/injection_container.dart';
import '../bloc/election_bloc.dart';
import '../bloc/election_event.dart';
import '../bloc/election_state.dart';

class ElectionsPage extends StatelessWidget {
  const ElectionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ElectionBloc>()..add(const ElectionListRequested()),
      child: const _ElectionsView(),
    );
  }
}

class _ElectionsView extends StatelessWidget {
  const _ElectionsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Elections')),
      body: BlocBuilder<ElectionBloc, ElectionState>(
        builder: (context, state) {
          if (state is ElectionLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ElectionFailure) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(state.message),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () {
                      context.read<ElectionBloc>().add(
                        const ElectionListRequested(),
                      );
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (state is ElectionsLoaded) {
            if (state.elections.isEmpty) {
              return const Center(child: Text('No elections available.'));
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: state.elections.length,
              itemBuilder: (context, index) {
                final election = state.elections[index];

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(election.title),
                    subtitle: Text(election.description),
                    trailing: Text(election.status.name.toUpperCase()),
                  ),
                );
              },
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}
